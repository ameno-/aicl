// AICL-72 — M1 exit drill: scripted kill / restart / redeploy durability check.
// One file, no new deps. Safe to re-run: every scenario uses actor keys unique
// to this run (`drill-<runId>`), and the drill destroys its own runner sandbox
// (scenario 5).
//
// Scenarios:
//   1. nasir-kill      SIGKILL the worker mid-run; the run must resume and settle
//                      exactly once (one user message, one complete answer).
//   2. nasir-redeploy  `compose up -d --build --wait worker` mid-run; same criteria.
//   3. runner-kill     SIGKILL the worker while a sandbox command runs; the side
//                      effect must happen exactly once and the sandbox container
//                      must be the same one. Interrupted-turn output is recorded
//                      as a finding, not a pass criterion.
//   4. engine-restart  `compose restart rivet-engine`; ping count continues, a
//                      fresh nasir agent answers.
//   5. cleanup         destroy the scenario-3 runner; no sandbox containers from
//                      this run remain.
//
// Docker control: `docker compose ...` via execFileSync with explicit timeouts
// (cwd = this package). Exits non-zero if any scenario FAILs.

import { execFileSync } from "node:child_process";
import type { Message } from "@earendil-works/pi-ai";
import type { ContextView, SubmissionRecord } from "@earendil-works/pi-durable";
import { createClient } from "rivetkit/client";
import type { registry } from "../src/registry.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "workbench-sandbox:codex-0.162.1";
const OCTO = "Write a numbered list of 40 short facts about octopuses.";

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({ endpoint, token: process.env.RIVET_TOKEN });
const runId = `d${Date.now().toString(36)}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- docker / compose helpers -----------------------------------------------

function docker(args: string[], timeoutMs = 120_000): string {
	return execFileSync("docker", ["compose", ...args], {
		cwd: ROOT,
		timeout: timeoutMs,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});
}

type PsLine = { Service?: string; State?: string; Health?: string };

function composePs(): PsLine[] {
	const out = docker(["ps", "--format", "json"], 30_000).trim();
	if (!out) return [];
	try {
		const parsed: unknown = JSON.parse(out);
		if (Array.isArray(parsed)) return parsed as PsLine[];
	} catch {
		// compose < v2.23 prints one JSON object per line
	}
	return out
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as PsLine);
}

function serviceStatus(service: string): PsLine | undefined {
	return composePs().find((line) => line.Service === service);
}

/** Polls until `attempt` returns a truthy value or the deadline passes. */
async function until<T>(
	deadlineMs: number,
	intervalMs: number,
	attempt: () => Promise<T | undefined | null>,
): Promise<T | undefined> {
	const deadline = Date.now() + deadlineMs;
	while (Date.now() < deadline) {
		try {
			const value = await attempt();
			if (value) return value;
		} catch {
			// retry until the deadline (e.g. worker down, engine restarting)
		}
		await sleep(intervalMs);
	}
	return undefined;
}

async function waitEngineHealthy(deadlineMs = 300_000): Promise<void> {
	const ping = client.ping.getOrCreate(["smoke"]);
	const ok = await until(deadlineMs, 2_000, async () => {
		const engine = serviceStatus("rivet-engine");
		if (engine?.Health !== "healthy") return undefined;
		await ping.ping();
		return true;
	});
	if (!ok) throw new Error(`engine not healthy within ${deadlineMs / 1000}s`);
}

async function waitWorkerReady(deadlineMs = 180_000): Promise<void> {
	const ping = client.ping.getOrCreate(["smoke"]);
	const ok = await until(deadlineMs, 2_000, async () => {
		const worker = serviceStatus("worker");
		if (!worker || worker.State !== "running") return undefined;
		await ping.ping();
		return true;
	});
	if (!ok) throw new Error(`worker not ready within ${deadlineMs / 1000}s`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
		),
	]);
}

function sandboxIds(): string[] {
	// plain docker ps: `compose ps` does not support the ancestor filter
	return execFileSync(
		"docker",
		["ps", "-a", "--filter", `ancestor=${SANDBOX_IMAGE}`, "--format", "{{.ID}}"],
		{ cwd: ROOT, timeout: 30_000, encoding: "utf8" },
	)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

/** sandboxId is `docker/<full container id>` or a bare id; normalize to the id. */
function normSandbox(sandboxId: string | null | undefined): string | null {
	if (!sandboxId) return null;
	return sandboxId.startsWith("docker/") ? sandboxId.slice("docker/".length) : sandboxId;
}

function sameContainer(a: string, b: string): boolean {
	return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Reads every drill.txt found in the sandbox (Codex cwd is /home/sandbox). */
function dockerExecCat(container: string): string {
	const script =
		"for f in $( { [ -f /home/sandbox/drill.txt ] && echo /home/sandbox/drill.txt; " +
		"find /home /tmp /root /workspace -maxdepth 4 -name drill.txt 2>/dev/null; } | sort -u ); do " +
		'echo "== $f"; cat "$f" 2>/dev/null; done';
	return execFileSync("docker", ["exec", container, "sh", "-c", script], {
		cwd: ROOT,
		timeout: 30_000,
		encoding: "utf8",
	});
}

/** Best-effort: what the worker logs say about resuming after the restart. */
function workerLogFindings(): string {
	try {
		const logs = docker(["logs", "--tail", "200", "worker"], 30_000);
		const lines = logs
			.split("\n")
			.filter((line) => /resum|retry|recover|replay|interrupt|reconnect|run_start|drain/i.test(line))
			.slice(-2)
			.map((line) => line.slice(0, 200));
		return lines.join(" | ") || "(no resume/retry lines in last 200 worker log lines)";
	} catch {
		return "(worker logs unavailable)";
	}
}

// --- conversation inspection --------------------------------------------------

function textOf(message: Message): string {
	if (typeof message.content === "string") return message.content;
	let text = "";
	for (const block of message.content ?? []) {
		if (block.type === "text") text += block.text;
	}
	return text;
}

function scan(context: ContextView, prompt: string) {
	let userCount = 0;
	const assistant: string[] = [];
	const kinds: string[] = [];
	let toolCallEntries = 0;
	for (const entry of context.entries) {
		kinds.push(entry.kind);
		for (const message of (entry.model ?? []) as readonly Message[]) {
			const text = textOf(message);
			if (message.role === "user" && text.includes(prompt)) userCount += 1;
			if (message.role === "assistant" && text.trim()) assistant.push(text);
			if (
				message.role === "assistant" &&
				Array.isArray(message.content) &&
				message.content.some((block) => block.type === "toolCall")
			) {
				toolCallEntries += 1;
			}
		}
	}
	return { userCount, assistant, kinds, toolCallEntries };
}

// --- scenarios -----------------------------------------------------------------

async function nasirScenario(mode: "kill" | "redeploy", ev: string[]) {
	const nasir = client.nasir.getOrCreate(["me", `drill-${runId}-${mode}`]);
	const root = await nasir.harness.root();
	// Non-blocking submit, exactly like web/useAgentChat.ts `send`.
	const submission = await nasir.conversation.submit(root.id, {
		type: "input",
		content: OCTO,
	});
	const started = await until(60_000, 1_000, async () => {
		const status: SubmissionRecord | undefined = await nasir.submission.status(submission.id);
		return status && (status.status === "placed" || status.status === "done") ? status : undefined;
	});
	if (!started) throw new Error("run never started (submission not placed within 60s)");
	await sleep(10_000); // the model call is in flight now

	if (mode === "kill") {
		docker(["kill", "-s", "SIGKILL", "worker"], 60_000);
		docker(["start", "worker"], 60_000);
	} else {
		docker(["up", "-d", "--build", "--wait", "worker"], 900_000);
	}
	await waitWorkerReady(180_000);

	const settled = await until(180_000, 3_000, async () => {
		const status: SubmissionRecord | undefined = await nasir.submission.status(submission.id);
		return status && (status.status === "done" || status.status === "unanswered") ? status : undefined;
	});
	const context = await nasir.conversation.context(root.id);
	const { userCount, assistant, kinds, toolCallEntries } = scan(context, OCTO);
	// The settled submission's `answer` points at THE final answer entry; retried
	// attempts appear as short tool-call preambles, not duplicate answers.
	const answerId = settled && settled.status === "done" ? settled.answer : undefined;
	const answerText = (context.entries.find((entry) => entry.id === answerId)?.model ?? [])
		.filter((message) => message.role === "assistant")
		.map((message) => textOf(message as Message))
		.join("");
	const complete = /\b(40|forty)\b/i.test(answerText);
	const fullAnswers = assistant.filter((text) => text.length >= 200).length;
	ev.push(
		`submission=${settled?.status ?? "never-settled"} entry-kinds=${kinds.join(",") || "(none)"} retried-tool-call-preambles=${toolCallEntries}`,
	);
	ev.push(
		`user-with-prompt=${userCount} assistant-text-entries=${assistant.length} (lengths ${assistant.map((t) => t.length).join("/") || "-"}) full-answers(>=200ch)=${fullAnswers}`,
	);
	ev.push(
		`answer-entry=${answerId ?? "none"} complete=${complete} snippet="${answerText.slice(0, 90).replace(/\n/g, " ")}" | worker-log: ${workerLogFindings()}`,
	);
	if (!settled) throw new Error("run did not settle within 180s of worker recovery");
	if (settled.status !== "done") throw new Error(`settled as ${settled.status}, expected done`);
	if (userCount !== 1) throw new Error(`expected 1 user message with the prompt, found ${userCount}`);
	if (fullAnswers !== 1) throw new Error(`expected exactly 1 full answer, found ${fullAnswers}`);
	if (!complete) throw new Error("answer is incomplete (does not mention the 40-fact list)");
}

async function runnerScenario(ev: string[]) {
	const rid = `drill-${runId}`;
	const runner = client.runner.getOrCreate(["me", rid, "codex-opencode"]);
	const known = new Set(sandboxIds());

	// Fire without awaiting: the call fails when the worker dies mid-command.
	const fired = { error: null as string | null, result: null as string | null, at: 0 };
	const firedAt = Date.now();
	void withTimeout(
		runner
			.say(`Run this exact shell command: sleep 25 && echo ${rid} >> drill.txt ; then print drill.txt`)
			.then(
				(result) => {
					fired.result = `stopReason=${result.stopReason ?? "none"} text=${result.text.slice(0, 120).replace(/\n/g, " ")}`;
					fired.at = Date.now() - firedAt;
				},
				(error) => {
					fired.error = error instanceof Error ? error.message : String(error);
					fired.at = Date.now() - firedAt;
				},
			),
		600_000,
		"interrupted say",
	);

	const container = await until(150_000, 2_000, async () => {
		return sandboxIds().find((id) => !known.has(id));
	});
	if (!container) throw new Error("sandbox container never appeared");
	await sleep(8_000); // sleep 25 is running inside the sandbox now

	docker(["kill", "-s", "SIGKILL", "worker"], 60_000);
	docker(["start", "worker"], 60_000);
	await waitWorkerReady(180_000);
	await sleep(40_000); // the command finishes inside the still-running sandbox

	const after = await runner.history();
	const sandboxAfter = normSandbox(after.sandboxId);
	if (!sandboxAfter) throw new Error("history().sandboxId is null after the restart");
	const same = sameContainer(container, sandboxAfter);
	// Count the side effect BEFORE the second say, to attribute any duplication.
	const catBefore = dockerExecCat(sandboxAfter);
	const beforeCount = catBefore.split("\n").filter((line) => line.trim() === rid).length;

	const second = await withTimeout(
		runner.say("Print the contents of drill.txt. Do not modify it."),
		300_000,
		"second say",
	);
	const catAfter = dockerExecCat(sandboxAfter);
	const afterCount = catAfter.split("\n").filter((line) => line.trim() === rid).length;

	const lastUser = after.turns.map((t) => t.sender).lastIndexOf("user");
	const interrupted = after.turns
		.slice(0, lastUser === -1 ? after.turns.length : lastUser)
		.filter((turn) => turn.sender === "assistant");
	const snippet = interrupted.at(-1)?.text.slice(0, 80) ?? "";

	ev.push(
		`interrupted-say (client) after ${Math.round(fired.at / 1000)}s: ${fired.error ? `failed (${fired.error.slice(0, 80)})` : `resolved: ${fired.result}`}; second-say stopReason=${second.stopReason ?? "none"}`,
	);
	ev.push(`sandbox before=${container.slice(0, 12)} after=${sandboxAfter.slice(0, 12)} same=${same}`);
	ev.push(
		`drill.txt marker lines: before-second-say=${beforeCount} after=${afterCount} (finding: interrupted assistant output ${interrupted.length > 0 ? `present: "${snippet}"` : "absent"})`,
	);
	if (!same) throw new Error("sandbox container changed across the worker kill");
	if (afterCount !== 1) {
		throw new Error(
			`expected exactly 1 '${rid}' line in drill.txt, found ${afterCount} (before second say: ${beforeCount}); raw: ${catAfter.slice(0, 160).replace(/\n/g, " ")}`,
		);
	}
}

async function engineScenario(ev: string[]) {
	docker(["restart", "rivet-engine"], 300_000);
	await waitEngineHealthy(300_000);
	const ping = client.ping.getOrCreate(["smoke"]);
	const first = await ping.ping();
	const second = await ping.ping();
	const nasir = client.nasir.getOrCreate(["me", `drill-eng-${runId}`]);
	const reply = await withTimeout(nasir.prompt("Reply with exactly: engine-ok"), 180_000, "nasir prompt");
	const pingOk = first.count >= 1 && second.count === first.count + 1;
	const nasirOk = reply.status === "done" && (reply.text ?? "").includes("engine-ok");
	const replyText = reply.status === "done" ? (reply.text ?? "") : "";
	ev.push(`ping ${first.count} -> ${second.count} (continues=${pingOk})`);
	ev.push(`nasir status=${reply.status} text=${replyText.slice(0, 60).replace(/\n/g, " ")}`);
	if (!pingOk) throw new Error("ping count did not continue across the engine restart");
	if (!nasirOk) throw new Error(`nasir prompt did not answer engine-ok (status=${reply.status})`);
}

async function cleanupScenario(ev: string[]) {
	const rid = `drill-${runId}`;
	const runner = client.runner.getOrCreate(["me", rid, "codex-opencode"]);
	const destroyed = await withTimeout(runner.destroy(), 180_000, "runner.destroy");
	const destroyedId = normSandbox(destroyed.destroyed) ?? "";
	// Container teardown is asynchronous at the daemon level; poll before judging.
	const gone = await until(30_000, 2_000, async () => {
		const remaining = sandboxIds();
		return remaining.some((id) => destroyedId !== "" && sameContainer(id, destroyedId))
			? undefined
			: true;
	});
	const remaining = sandboxIds();
	const leaked = remaining.filter((id) => destroyedId !== "" && sameContainer(id, destroyedId));
	ev.push(`runner.destroy -> ${destroyed.destroyed ?? "none"} (container gone=${Boolean(gone)})`);
	ev.push(
		`sandbox containers (${SANDBOX_IMAGE}) remaining: ${remaining.length}; from this run: ${leaked.length}`,
	);
	if (!gone) throw new Error(`drill sandbox containers still present: ${leaked.join(",")}`);
}

// --- harness -------------------------------------------------------------------

type Result = { name: string; pass: boolean; evidence: string[] };
const results: Result[] = [];

async function scenario(name: string, run: (ev: string[]) => Promise<void>) {
	const ev: string[] = [];
	let pass = true;
	try {
		await run(ev);
	} catch (error) {
		pass = false;
		ev.push(`error: ${error instanceof Error ? error.message : String(error)}`);
	}
	results.push({ name, pass, evidence: ev.slice(0, 4) });
}

async function main() {
	console.log(`drill runId=${runId} endpoint=${endpoint}`);
	console.log("waiting for a healthy stack…");
	await waitEngineHealthy(120_000);
	await waitWorkerReady(120_000);

	await scenario("1 nasir hard kill mid-run", (ev) => nasirScenario("kill", ev));
	await scenario("2 nasir graceful redeploy mid-run", (ev) => nasirScenario("redeploy", ev));
	await scenario("3 runner hard kill mid-command", runnerScenario);
	await scenario("4 engine restart", engineScenario);
	await scenario("5 cleanup drill sandbox", cleanupScenario);

	console.log("\n=== drill summary ===");
	let failures = 0;
	for (const result of results) {
		console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}`);
		for (const line of result.evidence) console.log(`      ${line}`);
		if (!result.pass) failures += 1;
	}
	if (failures > 0) {
		console.log(`\nDRILL FAILED: ${failures} scenario(s) failed`);
		process.exit(1);
	}
	console.log("\nDRILL PASSED: all scenarios passed");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
