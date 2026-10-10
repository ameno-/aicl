// Host-side agent smoke: one prompt through the pi() agent. Exit 0 only when
// the call is `done` (inverted by --expect-fail, e.g. after logout).
import { createClient } from "rivetkit/client";
import type { registry } from "../src/registry.ts";

const expectFail = process.argv.includes("--expect-fail");

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({
	endpoint,
	token: process.env.RIVET_TOKEN,
});

async function main() {
	const agent = client.agent.getOrCreate(["me", "smoke"]);
	const result = await agent.prompt("Reply with exactly: pong", {
		requestId: crypto.randomUUID(),
	});
	console.log(`status=${result.status}`);
	if (result.status === "done") {
		console.log(`text=${result.text}`);
	} else {
		console.log(`reason=${result.reason}`);
		const record = await agent.submission.status(result.submissionId);
		console.log(`detail=${record?.detail ?? "none"}`);
	}
	const ok = (result.status === "done") !== expectFail;
	process.exit(ok ? 0 : 1);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(expectFail ? 0 : 1);
});
