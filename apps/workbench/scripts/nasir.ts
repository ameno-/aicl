// Host-side Nasir client: prompt the nasir agent, optionally in a fresh
// conversation, or read the last assistant reply of its root conversation.
import type { ConversationId } from "@earendil-works/pi-durable";
import { createClient } from "rivetkit/client";
import type { registry } from "../src/registry.ts";

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({
	endpoint,
	token: process.env.RIVET_TOKEN,
});

const usage = "usage: nasir.ts say \"<text>\" [--key <k>] [--new-conversation] | last [--key <k>]";

function parseFlags(argv: string[]) {
	const flags = { key: "nasir", newConversation: false, text: "" };
	const words: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--key") flags.key = argv[++i] ?? "";
		else if (argv[i] === "--new-conversation") flags.newConversation = true;
		else words.push(argv[i]);
	}
	flags.text = words.join(" ");
	return flags;
}

async function main() {
	const [subcommand, ...rest] = process.argv.slice(2);
	const flags = parseFlags(rest);
	const nasir = client.nasir.getOrCreate(["me", flags.key]);

	if (subcommand === "say") {
		if (!flags.text) throw new Error(usage);
		// A fresh conversation only knows what the persona sections and
		// MEMORY.md carry — no history from the root conversation.
		let conversationId: ConversationId | undefined;
		if (flags.newConversation) {
			const created = await nasir.harness.createConversation({
				ownership: { kind: "ownerless" },
			});
			conversationId = created.id;
		}
		const result = await nasir.prompt(flags.text, {
			conversationId,
			requestId: crypto.randomUUID(),
		});
		console.log(`status=${result.status}`);
		if (result.status === "done") {
			console.log(`text=${result.text}`);
		} else {
			console.log(`reason=${result.reason}`);
			const record = await nasir.submission.status(result.submissionId);
			console.log(`detail=${record?.detail ?? "none"}`);
		}
		return;
	}

	if (subcommand === "last") {
		// schedules client pattern: the last message of the root conversation.
		const root = await nasir.harness.root();
		const { messages } = await nasir.conversation.context(root.id);
		let last = "";
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			if (message.role !== "assistant") continue;
			for (const block of message.content) {
				if (block.type === "text") last += block.text;
			}
			break;
		}
		console.log(last || "No assistant reply yet.");
		return;
	}

	throw new Error(usage);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
