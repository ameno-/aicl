// Host-side runner client: say / history / destroy for one runner actor at
// key ["me", <runnerId>, <loadout>].
import { createClient } from "rivetkit/client";
import { Agent, setGlobalDispatcher } from "undici";
import type { registry } from "../src/registry.ts";
import { DEFAULT_LOADOUT, LOADOUTS, type LoadoutId } from "../src/loadouts.ts";

// A say lasts as long as the Codex turn (up to the actor's 10 min
// actionTimeout); Node's fetch would give up on headers after 300s.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({
	endpoint,
	token: process.env.RIVET_TOKEN,
});

const usage =
	'usage: runner.ts say "<text>" --id <runnerId> [--loadout codex-opencode|codex-native]\n' +
	"       runner.ts history --id <runnerId> [--loadout ...]\n" +
	"       runner.ts destroy --id <runnerId> [--loadout ...]";

function parseFlags(argv: string[]) {
const flags = { id: "", loadout: DEFAULT_LOADOUT as string, text: "" };
	const words: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--id") flags.id = argv[++i] ?? "";
		else if (argv[i] === "--loadout") flags.loadout = argv[++i] ?? "";
		else words.push(argv[i]);
	}
	flags.text = words.join(" ");
	return flags;
}

async function main() {
	const [subcommand, ...rest] = process.argv.slice(2);
	const flags = parseFlags(rest);
	if (!flags.id) throw new Error(usage);
	if (!(flags.loadout in LOADOUTS)) {
		throw new Error(`unknown loadout '${flags.loadout}' (expected ${Object.keys(LOADOUTS).join("|")})`);
	}
	const runner = client.runner.getOrCreate(["me", flags.id, flags.loadout as LoadoutId]);

	if (subcommand === "say") {
		if (!flags.text) throw new Error(usage);
		const result = await runner.say(flags.text);
		if (result.model) console.log(`model=${result.model}`);
		console.log(result.text || `(no reply text; stopReason=${result.stopReason ?? "unknown"})`);
		return;
	}

	if (subcommand === "history") {
		const history = await runner.history();
		console.log(`loadout=${history.loadout} session=${history.sessionId ?? "none"} sandbox=${history.sandboxId ?? "none"}`);
		if (history.turns.length === 0) {
			console.log("(no turns yet)");
			return;
		}
		for (const turn of history.turns) {
			console.log(`--- ${turn.sender} ---`);
			console.log(turn.text);
		}
		return;
	}

	if (subcommand === "destroy") {
		const result = await runner.destroy();
		console.log(`destroyed sandbox=${result.destroyed ?? "none"}`);
		return;
	}

	throw new Error(usage);
}

main().catch((error) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : error);
	process.exit(1);
});
