// Runner: one Codex harness (via Sandbox Agent) per actor key
// ["me", runnerId, loadout], running in a local Docker sandbox.
//
// The brief asked for the stock `sandboxActor` from `rivetkit/sandbox`, but
// that export does not exist in rivetkit@2.3.26 (npm's latest; the package
// exports ".", "./workflow", ..., "./agent-os" only) and is not on npm under
// any other name. The stock pieces that ARE published are the Sandbox Agent
// TypeScript SDK (`sandbox-agent@0.5.2`, incl. its `docker` provider) plus the
// official Rivet actor + persist-driver pattern from Sandbox Agent's own docs
// (sandbox-agent/docs/content/docs/multiplayer.mdx — "Copy the Rivet persist
// driver from the example above into your project"). This actor is that
// pattern, with the actions copied from rivet's sandbox-coding-agent example.
//
// Session/sandbox durability: actor state is persisted by the engine, so
// `sandboxId` + session records + the full event transcript survive a worker
// restart; on the next `say` the SDK reconnects to the still-running sandbox
// container and resumes (replays into) the session.
import { actor, UserError } from "rivetkit";
import type { Registry } from "rivetkit";
import type { Client } from "rivetkit/client";
import {
	SandboxAgent,
	type ListEventsRequest,
	type ListPage,
	type ListPageRequest,
	type SandboxProvider,
	type SessionEvent,
	type SessionPersistDriver,
	type SessionRecord,
} from "sandbox-agent";
import { docker } from "sandbox-agent/docker";
import { credentials } from "./credentials.ts";
import Docker from "dockerode";
import { loadoutFromId, type RunnerLoadout } from "./loadouts.ts";
import { Agent, fetch as undiciFetch } from "undici";

// sandbox-agent/dist/providers/docker.js hard-codes image and dials the
// published host port at `http://${host}:${port}` (docker.js:8 and :78). From
// inside the worker container `127.0.0.1` (its default) would be the worker
// itself, not the host — hence host.docker.internal (built into Docker
// Desktop; on Linux add `extra_hosts: host.docker.internal:host-gateway`).
const SANDBOX_HOST = process.env.SANDBOX_AGENT_HOST ?? "host.docker.internal";
// Built by `npm run up` from sandbox/Dockerfile: the stock sandbox-agent
// image (sandbox-agent@0.5.2 default) plus a pinned Codex release. Docker's
// create API does not auto-pull, so ensureImagePulled() pulls missing images.
const SANDBOX_IMAGE =
	process.env.SANDBOX_IMAGE ?? "workbench-sandbox:codex-0.162.1";
// Resolvers for sandbox containers, comma-separated (unset: Docker's default).
// On a Linux host whose daemon DNS cannot resolve the tailnet gateway, use
// Tailscale's MagicDNS first, e.g. "100.100.100.100,1.1.1.1".
const SANDBOX_DNS = (process.env.SANDBOX_DNS ?? "")
	.split(",")
	.map((server) => server.trim())
	.filter(Boolean);
// Codex config for the litellm loadout (Codex config.toml format,
// openai/codex docs: model_provider + [model_providers.<id>] base_url /
// env_key / wire_api).
const GATEWAY_BASE_URL = "https://hostinger-gateway.tail98db32.ts.net:8449/v1";
// The full sandbox image runs as non-root user `sandbox` (sandbox-agent
// docker/runtime/Dockerfile.full:150-152), and the Docker daemon creates
// bind-mount parents as root, so codex could not write into a mounted
// ~/.codex. Instead the host auth.json is mounted read-only into a scratch
// dir and copied to /home/sandbox/.codex/auth.json, which codex then owns.
// The copy runs as root (docker exec): on Linux the mount keeps the host
// owner and mode 600, which the `sandbox` user cannot read.
const CODEX_AUTH_MOUNT = "/home/sandbox/.codex-host/auth.json";
const CODEX_AUTH = "/home/sandbox/.codex/auth.json";
const CODEX_CONFIG = "/home/sandbox/.codex/config.toml";

const dockerClient = new Docker({ socketPath: "/var/run/docker.sock" });

// ACP over HTTP holds a prompt's POST open for the whole Codex turn. Pi sets a
// global undici dispatcher with a 300s headers timeout, which would fail (and,
// unhandled inside acp-http-client, crash the worker) on any longer turn.
const sandboxDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const sandboxFetch = ((
	input: Parameters<typeof undiciFetch>[0],
	init?: Parameters<typeof undiciFetch>[1],
) =>
	undiciFetch(input, {
		...init,
		dispatcher: sandboxDispatcher,
	})) as unknown as typeof fetch;

// The narrow slice of a rivetkit action context the runner helpers need.
// client() mirrors rivetkit's own signature (src/actor/config.ts:447 and :66,
// `client<T = any>(): ActorClientFor<T>`).
type RunnerActionContext = {
	key: readonly string[];
	state: RunnerState;
	vars: { agent?: AgentBundle; running: boolean };
	client<T = any>(): T extends Registry<any> ? Client<T> : T;
};

// --- loadout-dependent sandbox wiring -------------------------------------

// The sandbox env is built at container-create time, reading the gateway key
// from the credentials actor (never from the worker env).
async function gatewayKey(c: RunnerActionContext): Promise<string> {
	const client = c.client<Registry<{ credentials: typeof credentials }>>();
	const credential = await client.credentials
		.getOrCreate([c.key[0]])
		.read("litellm");
	if (!credential || credential.type !== "api_key" || !credential.key) {
		throw new Error(
			"no litellm api_key credential; on the host run: npm run creds -- save-env litellm",
		);
	}
	return credential.key;
}

// Binds are resolved by the HOST daemon (dockerode HostConfig.Binds), so the
// source must be a host path. compose.yaml passes HOST_HOME=${HOME} because
// the worker's own $HOME is its container, not the host.
function authBind(): string {
	const hostHome = process.env.HOST_HOME ?? process.env.HOME;
	if (!hostHome) {
		throw new Error(
			"HOST_HOME is not set; cannot bind-mount ~/.codex/auth.json",
		);
	}
	return `${hostHome}/.codex/auth.json:${CODEX_AUTH_MOUNT}:ro`;
}

function codexConfigToml(loadout: RunnerLoadout): string {
	return [
		`model = "${loadout.model}"`,
		`model_provider = "litellm"`,
		"",
		"[model_providers.litellm]",
		`name = "litellm"`,
		`base_url = "${GATEWAY_BASE_URL}"`,
		`env_key = "LITELLM_API_KEY"`,
		`wire_api = "responses"`,
		"",
	].join("\n");
}

async function ensureImagePulled(): Promise<void> {
	try {
		await dockerClient.getImage(SANDBOX_IMAGE).inspect();
		return;
	} catch {
		// not present locally — pull below
	}
	const stream = await dockerClient.pull(SANDBOX_IMAGE, {});
	await new Promise<void>((resolve, reject) => {
		dockerClient.modem.followProgress(stream, (error: Error | null) =>
			error ? reject(error) : resolve(),
		);
	});
}

function buildProvider(
	env: () => Promise<string[]>,
	binds: () => string[],
): SandboxProvider {
	const base = docker({
		image: SANDBOX_IMAGE,
		host: SANDBOX_HOST,
		env,
		binds,
	});
	return {
		...base,
		async create() {
			await ensureImagePulled();
			if (SANDBOX_DNS.length === 0) return base.create();
			// Same container as the stock provider's create() (sandbox-agent
			// providers/docker.js), plus Dns: its createContainerOptions would
			// replace HostConfig wholesale. Docker picks the host port; the stock
			// getUrl() reads it back from inspect.
			const container = await dockerClient.createContainer({
				Image: SANDBOX_IMAGE,
				Cmd: ["server", "--no-token", "--host", "0.0.0.0", "--port", "3000"],
				Env: await env(),
				ExposedPorts: { "3000/tcp": {} },
				HostConfig: {
					AutoRemove: true,
					Binds: binds(),
					PortBindings: { "3000/tcp": [{ HostPort: "" }] },
					Dns: SANDBOX_DNS,
				},
			});
			await container.start();
			return container.id;
		},
	};
}

// --- session persistence in actor state (multiplayer.mdx pattern) ----------

type PersistData = {
	sessions: Record<string, SessionRecord>;
	events: Record<string, SessionEvent[]>;
};

class ActorStatePersistDriver implements SessionPersistDriver {
	private readonly state: { persist: PersistData };

	constructor(state: { persist: PersistData }) {
		this.state = state;
		if (!this.state.persist) {
			this.state.persist = { sessions: {}, events: {} };
		}
	}

	private get data(): PersistData {
		return this.state.persist;
	}

	async getSession(id: string): Promise<SessionRecord | undefined> {
		const session = this.data.sessions[id];
		return session ? { ...session } : undefined;
	}

	async listSessions(
		request: ListPageRequest = {},
	): Promise<ListPage<SessionRecord>> {
		const sorted = Object.values(this.data.sessions).sort(
			(a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
		);
		const offset = Number(request.cursor ?? 0);
		const limit = request.limit ?? 100;
		const items = sorted.slice(offset, offset + limit);
		return {
			items,
			nextCursor:
				offset + items.length < sorted.length
					? String(offset + items.length)
					: undefined,
		};
	}

	async updateSession(session: SessionRecord): Promise<void> {
		this.data.sessions[session.id] = { ...session };
		if (!this.data.events[session.id]) this.data.events[session.id] = [];
	}

	async listEvents(
		request: ListEventsRequest,
	): Promise<ListPage<SessionEvent>> {
		const all = [...(this.data.events[request.sessionId] ?? [])].sort(
			(a, b) => a.eventIndex - b.eventIndex || a.id.localeCompare(b.id),
		);
		const offset = Number(request.cursor ?? 0);
		const limit = request.limit ?? 100;
		const items = all.slice(offset, offset + limit);
		return {
			items,
			nextCursor:
				offset + items.length < all.length
					? String(offset + items.length)
					: undefined,
		};
	}

	async insertEvent(sessionId: string, event: SessionEvent): Promise<void> {
		const events = this.data.events[sessionId] ?? [];
		events.push({
			...event,
			payload: JSON.parse(JSON.stringify(event.payload)),
		});
		this.data.events[sessionId] = events;
	}
}

// --- transcript helpers -----------------------------------------------------

type Envelope = {
	method?: string;
	params?: {
		prompt?: Array<{ type: string; text?: string }>;
		update?: {
			sessionUpdate?: string;
			content?: { type?: string; text?: string };
		};
	};
};

function eventsFor(persist: PersistData, sessionId: string): SessionEvent[] {
	return [...(persist.events[sessionId] ?? [])].sort(
		(a, b) => a.eventIndex - b.eventIndex,
	);
}

function messageText(envelope: Envelope): string | null {
	if (envelope.method === "session/prompt") {
		const blocks = envelope.params?.prompt ?? [];
		return blocks
			.filter((block) => block.type === "text")
			.map((block) => block.text ?? "")
			.join("");
	}
	if (envelope.method === "session/update") {
		const update = envelope.params?.update;
		if (
			update?.sessionUpdate === "agent_message_chunk" &&
			update.content?.type === "text"
		) {
			return update.content.text ?? "";
		}
	}
	return null;
}

export type RunnerTurn = { sender: "user" | "assistant"; text: string };

function turnsFromEvents(events: SessionEvent[]): RunnerTurn[] {
	const turns: RunnerTurn[] = [];
	for (const event of events) {
		const text = messageText(event.payload as Envelope);
		if (!text) continue;
		const sender: RunnerTurn["sender"] =
			event.sender === "client" ? "user" : "assistant";
		const last = turns.at(-1);
		if (last && last.sender === sender) last.text += text;
		else turns.push({ sender, text });
	}
	return turns;
}

// --- the actor ---------------------------------------------------------------

type RunnerState = {
	sandboxId: string | null;
	sessionId: string | null;
	persist: PersistData;
};

type AgentBundle = {
	sdk: SandboxAgent;
	loadout: RunnerLoadout;
	setupDone: boolean;
};

type RunnerContext = RunnerActionContext;

function loadoutFor(c: RunnerContext): RunnerLoadout {
	return loadoutFromId(c.key[2]);
}

async function getAgent(c: RunnerContext): Promise<AgentBundle> {
	if (c.vars.agent) return c.vars.agent;
	const loadout = loadoutFor(c);
	const build = () =>
		SandboxAgent.start({
			sandbox: buildProvider(
				async () =>
					loadout.auth === "litellm"
						? [`LITELLM_API_KEY=${await gatewayKey(c)}`]
						: [],
				() => (loadout.auth === "chatgpt-login" ? [authBind()] : []),
			),
			sandboxId: c.state.sandboxId ?? undefined,
			persist: new ActorStatePersistDriver(c.state),
			fetch: sandboxFetch,
		});

	let sdk: SandboxAgent;
	try {
		sdk = await build();
	} catch (error) {
		if (!c.state.sandboxId) throw error;
		// The sandbox container is gone (e.g. host reboot with AutoRemove).
		// Drop the container reference and recreate; the transcript replays
		// from persisted events into a fresh session.
		c.state.sandboxId = null;
		sdk = await build();
	}

	c.state.sandboxId = sdk.sandboxId ?? c.state.sandboxId;
	c.vars.agent = { sdk, loadout, setupDone: false };
	return c.vars.agent;
}

// One-time-per-sandbox-agent-config: write Codex's config/auth before the
// first session of this SDK connection. Both writes are idempotent.
async function ensureSetup(bundle: AgentBundle): Promise<void> {
	if (bundle.setupDone) return;
	if (bundle.loadout.auth === "litellm") {
		await bundle.sdk.writeFsFile(
			{ path: CODEX_CONFIG },
			codexConfigToml(bundle.loadout),
		);
	} else {
		const containerId = (bundle.sdk.sandboxId ?? "").replace(/^docker\//, "");
		const exec = await dockerClient.getContainer(containerId).exec({
			User: "root",
			Cmd: ["install", "-D", "-o", "sandbox", "-g", "sandbox", "-m", "600", CODEX_AUTH_MOUNT, CODEX_AUTH],
			AttachStdout: true,
			AttachStderr: true,
		});
		const stream = await exec.start({});
		await new Promise((resolve) => {
			stream.on("end", resolve);
			stream.resume();
		});
		const { ExitCode } = await exec.inspect();
		if (ExitCode !== 0) {
			throw new Error(`copying Codex auth.json into the sandbox failed (exit ${ExitCode})`);
		}
	}
	bundle.setupDone = true;
}

async function currentModel(
	sdk: SandboxAgent,
	sessionId: string,
): Promise<string | null> {
	try {
		const session = await sdk.getSession(sessionId);
		const option = (await session?.getConfigOptions())?.find(
			(item) => item.category === "model",
		);
		if (option?.type === "select") return option.currentValue;
	} catch {
		// config options are optional in ACP
	}
	return null;
}

export const runner = actor({
	state: {
		sandboxId: null as string | null,
		sessionId: null as string | null,
		// Prompt of the turn in flight; still set on wake means the worker died
		// mid-turn. The caller (rivetkit client or engine) retries the action,
		// so without this a non-idempotent command would run twice.
		pending: null as string | null,
		persist: { sessions: {}, events: {} } as PersistData,
	},
	// Runtime-only (not persisted); recreated on every wake.
	createVars: () => ({
		agent: undefined as AgentBundle | undefined,
		running: false,
	}),
	// Codex turns can take minutes (and the first say also starts/pulls the
	// sandbox); rivetkit's default actionTimeout is 60s
	// (rivetkit/src/actor/config.ts:1309). Same override Foundry uses.
	options: { actionTimeout: 10 * 60_000 },
	actions: {
		say: async (c, text: string) => {
			const prompt = text?.trim();
			if (!prompt) throw new Error("text is required");

			// A retry of a still-running say (the engine gateway gives up on an
			// action after 300s and the client resends it) must not start a second turn.
			if (c.vars.running) {
				throw new UserError(
					"a turn is still running in this runner; check history before sending again",
				);
			}
			if (c.state.pending !== null) {
				c.state.pending = null;
				throw new UserError(
					"previous turn was interrupted by a worker restart and was not re-sent; check history, then send again if needed",
				);
			}
			c.state.pending = prompt;
			c.vars.running = true;
			await c.saveState({ immediate: true });

			// RivetKit hides non-UserError messages as "internal error"; surface
			// sandbox/harness failures to the caller.
			try {
				const bundle = await getAgent(c);
				await ensureSetup(bundle);

				const sessionId = c.state.sessionId ?? "main";
				const session = await bundle.sdk.resumeOrCreateSession({
					id: sessionId,
					agent: bundle.loadout.agent,
					// Foundry (foundry/packages/backend/src/actors/sandbox/index.ts:90)
					// forces codex into full-access; without it codex runs read-only and
					// every exec_command escalates into an ACP permission request.
					// Applied on create and resume (sandbox-agent chunk-TEHINGEG.js:1312/:1357).
					mode: bundle.loadout.mode,
				});
				c.state.sessionId = session.id;

				const previous =
					eventsFor(c.state.persist, session.id).at(-1)?.eventIndex ?? -1;
				const result = await session.prompt([{ type: "text", text: prompt }]);
				const events = eventsFor(c.state.persist, session.id);
				const reply = turnsFromEvents(
					events.filter((event) => event.eventIndex > previous),
				)
					.filter((turn) => turn.sender === "assistant")
					.map((turn) => turn.text)
					.join("");

				return {
					text: reply,
					stopReason: result.stopReason ?? null,
					model: await currentModel(bundle.sdk, session.id),
					sessionId: session.id,
					sandboxId: c.state.sandboxId,
				};
			} catch (error) {
				throw new UserError(
					error instanceof Error ? error.message : String(error),
				);
			} finally {
				c.state.pending = null;
				c.vars.running = false;
			}
		},

		history: (c) => {
			const sessionId =
				c.state.sessionId ??
				Object.values(c.state.persist.sessions)
					.sort((a, b) => a.createdAt - b.createdAt)
					.at(-1)?.id ??
				null;
			return {
				loadout: loadoutFor(c).id,
				sessionId,
				sandboxId: c.state.sandboxId,
				turns: sessionId
					? turnsFromEvents(eventsFor(c.state.persist, sessionId))
					: [],
			};
		},

		destroy: async (c) => {
			const sandboxId = c.state.sandboxId;
			if (sandboxId) {
				const rawId = sandboxId.startsWith("docker/")
					? sandboxId.slice("docker/".length)
					: sandboxId;
				await docker({ host: SANDBOX_HOST }).destroy(rawId);
			}
			if (c.vars.agent) {
				try {
					await c.vars.agent.sdk.dispose();
				} catch {
					// best-effort
				}
			}
			c.vars.agent = undefined;
			c.state.sandboxId = null;
			c.state.sessionId = null;
			c.state.pending = null;
			c.state.persist = { sessions: {}, events: {} };
			return { destroyed: sandboxId };
		},
	},
});
