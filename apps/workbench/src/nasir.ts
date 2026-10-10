// Nasir: a stock pi() agent. Its persona is prompt sections loaded once from
// the repo's nasir/ files; its long-term memory is a durable MEMORY.md in its
// own actor storage (no sandbox: read/write/edit act on the actor's SQLite,
// built-in-tools.mdx); it wakes on a heartbeat cron (schedules.mdx pattern).
import { readFileSync } from "node:fs";
import { createRegistry, defineExtension, section } from "@earendil-works/pi-durable";
import { createEditTool, createReadTool, createWriteTool } from "@earendil-works/pi-durable/tools";
import { pi } from "@rivet-dev/pi";
import { type Registry } from "rivetkit";
import { credentials } from "./credentials.ts";

export const NASIR_MODEL = "anthropic/claude-haiku-4-5-20251001";

// Persona files are read once at module load, not per call. They are relative
// to this module: src/nasir.ts -> ../nasir/.
const personaFile = (name: string) =>
	readFileSync(new URL(`../nasir/${name}`, import.meta.url), "utf8");
const soul = personaFile("SOUL.md");
const identity = personaFile("IDENTITY.md");
const user = personaFile("USER.md");
const heartbeat = personaFile("HEARTBEAT.md");

// This agent has no sandbox, so its files live in the Actor's own database
// and survive restarts (built-in-tools.mdx). There is no shell, so it gets
// read, write, and edit without bash.
const extensions = createRegistry();
extensions.install(defineExtension({ name: "nasir", sections: [
	section("soul", () => `${soul}\n\n${identity}`),
	section("user", () => user),
	section("memory-protocol", () =>
		"Your long-term memory is the file MEMORY.md in your own file storage. " +
		"At the start of every conversation, read MEMORY.md (it may not exist yet). " +
		"When the user asks you to remember something, or you learn a durable fact " +
		"about the user or their work, update MEMORY.md with the edit or write tool. " +
		"Keep it concise."),
]}));
extensions.install(defineExtension({ name: "files", tools: [createReadTool(), createWriteTool(), createEditTool()] }));

const nasir = pi({
	model: NASIR_MODEL,
	registry: extensions,
	// Same credential wiring as the `agent`: model access comes only from the
	// credentials actor, looked up at the first key component.
	credentials: (c) => {
		const client = c.client<Registry<{ credentials: typeof credentials }>>();
		return client.credentials.getOrCreate([c.key[0]]);
	},
	// schedules.mdx: onCreate sets the cron once, when the agent is first
	// created. Every heartbeat run continues the root conversation.
	onCreate: async (c) => {
		await c.cron.set({
			name: "heartbeat",
			expression: process.env.NASIR_HEARTBEAT_CRON ?? "*/30 * * * *",
			action: "prompt",
			args: [heartbeat],
		});
	},
});

export { nasir };
