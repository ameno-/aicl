// Runner loadouts ("gear"): plain data, chosen per runner key. The runner
// actor turns a loadout into sandbox env/binds/Codex config (src/runner.ts).
// Claude loadout is blocked on AICL-92.

export interface RunnerLoadout {
	id: LoadoutId;
	agent: "codex";
	/** Codex model. Omitted = the default Codex model (chatgpt-login). */
	model?: string;
	/** Where Codex gets its credentials. */
	auth: "litellm" | "chatgpt-login";
	/** ACP permission mode (Foundry uses "full-access"; codex-acp for Codex 0.162 names it "agent-full-access"); the
	 *  sandbox container is the isolation boundary. */
	mode: string;
}

export type LoadoutId = "codex-opencode" | "codex-native";

export const DEFAULT_LOADOUT: LoadoutId = "codex-opencode";

export const LOADOUTS: Record<LoadoutId, RunnerLoadout> = {
	"codex-opencode": {
		id: "codex-opencode",
		agent: "codex",
		model: "opencode-gpt-6-luna",
		auth: "litellm",
		mode: "agent-full-access",
	},
	"codex-native": {
		id: "codex-native",
		agent: "codex",
		auth: "chatgpt-login",
		mode: "agent-full-access",
	},
};

export function loadoutFromId(id: string | undefined): RunnerLoadout {
	const key = (id ?? DEFAULT_LOADOUT) as LoadoutId;
	return LOADOUTS[key] ?? LOADOUTS[DEFAULT_LOADOUT];
}
