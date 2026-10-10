import { createClient } from "rivetkit/client";
import type { registry } from "../src/registry.ts";

const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const client = createClient<typeof registry>({
	endpoint,
	token: process.env.RIVET_TOKEN,
});

async function main() {
	const ping = client.ping.getOrCreate(["smoke"]);

	const first = await ping.ping();
	const second = await ping.ping();

	console.log(`ping #1 -> count=${first.count}`);
	console.log(`ping #2 -> count=${second.count}`);

	if (second.count !== first.count + 1) {
		throw new Error(
			`expected count to increment once (first=${first.count}, second=${second.count})`,
		);
	}
	console.log("smoke ok");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
