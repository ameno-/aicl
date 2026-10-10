import { registry } from "./registry.ts";

// A self-hosted engine does not auto-create runner configs for serverful
// pools: only the Rust-runner path calls ensure_normal_if_missing
// (engine/packages/pegboard/src/workflows/runner2.rs), while RivetKit workers
// connect as envoys and fail with `no_runner_config`. Idempotently upsert a
// default `normal` pool config before starting.
const endpoint = process.env.RIVET_ENDPOINT ?? "http://localhost:6420";
const token = process.env.RIVET_TOKEN;
const headers: Record<string, string> = {
	"content-type": "application/json",
};
// Control-plane APIs authenticate via Authorization: Bearer (see
// docs/general/content/pool-configuration.mdx); the gateway actor APIs use
// x-rivet-token, which RivetKit sends itself.
if (token) headers.authorization = `Bearer ${token}`;

const dcsRes = (await (
	await fetch(`${endpoint}/datacenters`, { headers })
).json()) as { datacenters: { name: string }[] };

const res = await fetch(
	`${endpoint}/runner-configs/default?namespace=default`,
	{
		method: "PUT",
		headers,
		body: JSON.stringify({
			datacenters: Object.fromEntries(
				dcsRes.datacenters.map((dc) => [dc.name, { normal: {} }]),
			),
		}),
	},
);
if (!res.ok) {
	throw new Error(
		`failed to upsert default runner config: ${res.status} ${await res.text()}`,
	);
}

registry.start();
