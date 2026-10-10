# workbench

Smallest repeatable Rivet stack: self-hosted Rivet engine in Docker plus a
RivetKit worker running one `ping` actor, rebuilt from config on any host with
Docker + Node ≥ 22.6.

## Prerequisites

- Docker (Compose v2)
- Node ≥ 22.6

## Run

```bash
cp .env.example .env   # set RIVET_TOKEN (keep it out of git)
npm install
npm run up             # compose up -d --build --wait (waits for engine health)
npm run smoke          # client calls ping twice, asserts count increments
npm run down           # stop containers (state survives; restart continues count)
npm run reset          # down -v: wipes the engine volume, next smoke starts at 1
npm run logs           # follow compose logs
npm run typecheck
```

Host-specific settings (all optional, read from the shell env or `.env`):

| Variable | Default | When to set it |
|---|---|---|
| `RIVET_PORT` | `6420` | Host port for the engine API (always bound to 127.0.0.1). Set it when 6420 is taken, and point `RIVET_ENDPOINT` at it. |
| `SANDBOX_DNS` | Docker's default | Runner sandbox resolvers, comma-separated. On Linux, sandboxes cannot resolve the tailnet LiteLLM gateway with the daemon's DNS: use `100.100.100.100,1.1.1.1` (Tailscale MagicDNS first). |

On ai-lab the stack lives in `~/dev/nasir-workbench`. A `wb` function in `~/.zshrc`
holds `RIVET_TOKEN`, `RIVET_PORT=6440`, `RIVET_ENDPOINT` and `SANDBOX_DNS`, so that
host's other engine on 6420 is unaffected. Run every command through it, e.g.
`wb npm run up`, `wb npm run drill`. Save model keys from a machine that has them by
piping each one over SSH stdin into `npm run creds -- save-env <provider>`.

## What is pinned where

| Thing | Value | Where |
|---|---|---|
| RivetKit | `rivetkit@2.3.26` (exact) | `package.json` + `package-lock.json` |
| Engine image | `rivetdev/engine:full-2.3.26` | `compose.yaml` (matches rivetkit version) |
| Worker base image | `node:22-alpine` | `Dockerfile` |
| Engine admin token | `RIVET_TOKEN` env | `compose.yaml` (`RIVET__AUTH__ADMIN_TOKEN`), `.env` |
| Actor state | `ping.count` | named volume `rivet-engine-data` (`/var/lib/rivet-engine`) |

## How it fits together

- `rivet-engine` runs the pinned full engine image with a named volume for
  actor state; health is polled at `http://127.0.0.1:6421/health` (6420 is the
  public API port exposed to the host).
- `worker` installs this package with `npm ci` and runs
  `node --experimental-strip-types src/server.ts` (i.e. `registry.start()` in
  `src/registry.ts`), connecting to the engine via `RIVET_ENDPOINT` /
  `RIVET_TOKEN`. `stop_grace_period: 35m` lets actors drain like upstream's
  worker compose.
- `npm run smoke` uses `rivetkit/client` `createClient` against the engine,
  `getOrCreate(["smoke"])`, and calls the `ping` action twice.

## Credentials

The `agent` actor (Pi Durable, `pi()` from `@rivet-dev/pi`) gets its model
access only from the `credentials` actor — never from `.env`, `compose.yaml`,
or the worker environment. The lookup order inside the agent is: the `apiKeys`
option (not used here) → the `credentials` actor → the worker env (which has
no provider keys, so a successful call can only come from the actor).

Host-side management (`scripts/creds.ts`), against the `credentials` actor at
key `["me"]`:

```bash
npm run creds -- save-env anthropic   # reads ANTHROPIC_API_KEY from the host shell, saves it; the key is never printed
npm run creds -- list                 # prints providers + types only
npm run creds -- remove anthropic     # logout; applies to the very next model call, no restart
```

Model smoke test (expects the saved credential; passes with `--expect-fail`
when it is absent):

```bash
npm run agent-smoke                   # exit 0 only if status is "done"; prints the reply
npm run agent-smoke -- --expect-fail  # exit 0 only if the call fails; prints the failure detail
```

Keys never go in `.env` or `compose.yaml`: the worker container is started
with no `ANTHROPIC_API_KEY` or any other provider key.

## Nasir

The `nasir` actor (`src/nasir.ts`) is a stock `pi()` agent (model
`anthropic/claude-haiku-4-5-20251001`, credentials from the `credentials`
actor, same as `agent`) with no sandbox, so its file tools (`read`, `write`,
`edit` — no `bash`) act on files in the actor's own SQLite storage.

- **Persona** lives in `apps/workbench/nasir/`: `SOUL.md` + `IDENTITY.md`
  (the `soul` section), `USER.md` (the `user` section), and a fixed
  `memory-protocol` section — all installed as prompt sections via
  `defineExtension`. The files are read once at module load.
- **Long-term memory** is `MEMORY.md` in the actor's own storage: it survives
  restarts, and a fresh conversation can only know it by reading the file.
- **Heartbeat**: `onCreate` sets a cron (name `heartbeat`, action `prompt`
  with the `HEARTBEAT.md` checklist). Schedule comes from
  `NASIR_HEARTBEAT_CRON` (compose default `*/30 * * * *`, non-secret, see
  `.env.example`).

```bash
npm run nasir -- say "Who are you?" [--key nasir] [--new-conversation]
npm run nasir -- last [--key nasir]   # last assistant reply of the root conversation
```

`--new-conversation` prompts in a fresh `ownerless` conversation, which only
knows the persona sections and `MEMORY.md` — handy for proving memory
durability.

## Chat UI

Browser chat with the `nasir` actor (`["me", "nasir"]`), built from the stock
Rivet Agents React SDK example (`examples/docs/react-sdk`):

```bash
npm run up             # engine + worker must be healthy
npm run web            # vite dev server
open http://127.0.0.1:5190
```

Live streaming replies, history on reload (from the conversation snapshot),
and a Stop button (`conversation.abort`). The engine admin token
(`RIVET_TOKEN`) and endpoint (`RIVET_ENDPOINT`) are inlined into the dev
bundle by Vite's env handling — local browser only, single-user localhost
(scoping is M4 AICL-88). If the browser cannot reach the engine directly
(e.g. CORS), unset `RIVET_ENDPOINT` and the app falls back to the Vite dev
proxy at `/rivet` → `http://localhost:6420` (`vite.config.ts`).

## Runner

The `runner` actor (`src/runner.ts`) is one Codex harness per actor key
`["me", <runnerId>, <loadout>]`, running via Sandbox Agent
(`sandbox-agent` SDK, ACP) in a local Docker container (`docker` provider).
Loadouts (`src/loadouts.ts`, plain data) pick how Codex gets credentials:

- `codex-opencode` (default): Codex talks to the LiteLLM gateway
  (OpenAI Responses API) with model `opencode-gpt-6-luna`. The gateway key is
  read from the `credentials` actor at sandbox-creation time and passed as
  `LITELLM_API_KEY`; a `~/.codex/config.toml` is written into the sandbox.
- `codex-native`: Codex uses your own ChatGPT-subscription login. The host's
  `~/.codex/auth.json` is bind-mounted read-only (source resolved by the host
  daemon, hence `HOST_HOME=${HOME}` in compose.yaml) and copied to
  `/home/sandbox/.codex/auth.json`; default Codex model.

Sandboxes run the `workbench-sandbox:codex-0.162.1` image, which
`npm run up` builds from `sandbox/Dockerfile`: the stock Sandbox Agent image
plus a pinned Codex release. The stock image's Codex 0.116.0 is rejected by
ChatGPT accounts. Both loadouts use ACP mode `agent-full-access` (the
container is the boundary); without it Codex is read-only and every command
waits on a permission request.

The sandbox container and the session transcript survive a worker restart
(session records + events persist in actor state; the SDK resumes the session
in the still-running container).

```bash
npm run creds -- save-env litellm    # gateway key, once (reads LITELLM_API_KEY from the shell)
npm run runner -- say "Create proof.txt with: ok. Then print it." --id r1
npm run runner -- say "Reply with exactly: native-ok" --id r2 --loadout codex-native
npm run runner -- history --id r1
npm run runner -- destroy --id r1    # stops/removes the sandbox container
```

Prerequisites:

- `npm run creds -- save-env litellm` for `codex-opencode`.
- `codex login` (ChatGPT) on the host for `codex-native` (`~/.codex/auth.json`).
- `/var/run/docker.sock` is mounted into the `worker` service — the worker can
  control host Docker and starts/stops sandbox containers on it.

## Durability drill

```bash
npm run drill          # ~10 minutes; kills/restarts the worker and the engine
```

`scripts/drill.ts` proves M1 durability on any host by breaking the stack
mid-run and asserting the durable outcome, printing PASS/FAIL per scenario and
exiting non-zero on any FAIL. Every key is unique per run (`drill-<runId>`), so
it is safe to re-run, and at the end it destroys its runner sandbox and deletes
the actors it created.

1. **Nasir, hard kill**: SIGKILL the worker mid-run — the run must resume and
   settle exactly once (one user message, one complete final answer; retried
   attempts show up as short tool-call preambles, not duplicate answers).
2. **Nasir, graceful redeploy**: rebuild + replace the worker (`compose up -d
   --build --wait worker`) mid-run — same criteria. It also reports how long
   Nasir took to answer after the worker was back (minutes today: AICL-95).
3. **Runner, hard kill**: SIGKILL the worker while a command runs in the
   sandbox — the command's side effect must be exactly-once and the sandbox
   container must survive unchanged.
4. **Engine**: `compose restart rivet-engine` — the ping count continues and a
   fresh Nasir answers.
5. **Cleanup**: destroy the scenario-3 runner (no sandbox containers from this
   run remain) and delete this run's actors.

It controls Docker via `docker compose`, so run it when nothing else uses the
stack.

Runner turns are at-most-once across a worker crash: the client retries an
interrupted `say`, and the runner rejects that retry ("previous turn was
interrupted…") instead of re-sending a command that may already have run in
the still-running sandbox. Check `history`, then send again if needed.

A `say` is one HTTP action, and the engine gateway cuts actions at 300 s. For a
longer Codex turn the caller gets an error and the client's retry is rejected
("a turn is still running"), but the turn finishes and shows up in `history`.
A non-blocking `say` is AICL-96.
