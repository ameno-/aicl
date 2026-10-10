// Host-side credentials client: save/list/remove the model credentials the
// agent reads from the `credentials` actor. Secrets are never printed.
import { createClient } from "rivetkit/client";
import type { registry } from "../src/registry.ts";

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({
	endpoint,
	token: process.env.RIVET_TOKEN,
});

async function main() {
	const [subcommand, provider = "anthropic"] = process.argv.slice(2);
	const actor = client.credentials.getOrCreate(["me"]);

	if (subcommand === "save-env") {
		const key = process.env[`${provider.toUpperCase()}_API_KEY`];
		if (!key) {
			throw new Error(
				`no ${provider.toUpperCase()}_API_KEY in the host shell env; nothing saved`,
			);
		}
		await actor.save(provider, { type: "api_key", key });
		console.log(`saved ${provider} credential (api_key)`);
		return;
	}

	if (subcommand === "list") {
		const creds = await actor.list();
		for (const { providerId, type } of creds) {
			console.log(`${providerId} ${type}`);
		}
		return;
	}

	if (subcommand === "remove") {
		await actor.remove(provider);
		console.log(`removed ${provider} credential`);
		return;
	}

	throw new Error("usage: creds.ts save-env|list|remove [provider]");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
