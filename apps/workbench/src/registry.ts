import { createRegistry } from "@earendil-works/pi-durable";
import { pi } from "@rivet-dev/pi";
import { type Registry, actor, setup } from "rivetkit";
import { credentials } from "./credentials.ts";
import { nasir } from "./nasir.ts";

export const ping = actor({
	state: {
		count: 0,
	},
	actions: {
		ping: (c) => {
			c.state.count += 1;
			return { count: c.state.count };
		},
	},
});

// Upstream pattern: agents examples/docs/user-subscriptions/server.ts. The
// agent's only model credential source is the credentials actor (no apiKeys,
// and the worker env has no provider keys).
const agent = pi({
	model: "anthropic/claude-haiku-4-5-20251001",
	registry: createRegistry(),
	credentials: (c) => {
		const client = c.client<Registry<{ credentials: typeof credentials }>>();
		return client.credentials.getOrCreate([c.key[0]]);
	},
});

export const registry = setup({ use: { credentials, ping, agent, nasir } });
