import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import type { AgentEvent, ConversationId, EntryRecord, SnapshotEvent } from "@earendil-works/pi-durable";
import { createRivetKit } from "@rivetkit/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { registry } from "../src/registry.ts";

// The engine admin token is loaded from the host shell / .env by Vite's env
// handling (envPrefix: ["VITE_", "RIVET_"], envDir: package root in
// ../vite.config.ts) and inlined into the dev bundle. This exposes the admin
// token to the local browser only — fine for single-user localhost; M4 AICL-88
// scopes it.
//
// Endpoint: RIVET_ENDPOINT (set in .env for the CLI/worker) points the browser
// straight at http://localhost:6420 — the engine answers CORS preflights with
// access-control-allow-origin: * (verified against engine 2.3.26). If it is
// unset, the app falls back to the Vite dev proxy at /rivet, which forwards to
// http://localhost:6420 (same-origin, no CORS needed; see ../vite.config.ts).
const endpoint = import.meta.env.RIVET_ENDPOINT ?? "/rivet";
const token = import.meta.env.RIVET_TOKEN;

const { useActor } = createRivetKit<typeof registry>({ endpoint, token });

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function useAgentChat(key: string[]) {
	const agent = useActor({ name: "nasir", key });
	const conn = agent.connection;
	const [rootId, setRootId] = useState<ConversationId | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streaming, setStreaming] = useState("");
	const [tool, setTool] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const lastSeq = useRef(0);

	// A snapshot replaces everything the hook has.
	const applySnapshot = useCallback((snapshot: SnapshotEvent) => {
		setMessages(snapshot.entries.flatMap(toChatMessages));
		setStreaming(snapshot.generation?.message ? textOf(snapshot.generation.message) : "");
		setTool(snapshot.tools.find((slot) => slot.status === "running")?.name ?? null);
		setRunning(snapshot.run !== undefined);
	}, []);

	// Reads the conversation, then sends its events to this connection as pi.events.
	const watch = useCallback(async () => {
		if (!conn) return;
		const root = await conn.harness.root();
		lastSeq.current = 0;
		const { snapshot } = await conn.conversation.watchEvents(root.id);
		applySnapshot(snapshot);
		setRootId(root.id);
	}, [conn, applySnapshot]);

	useEffect(() => {
		void watch();
	}, [watch]);

	agent.useEvent("pi.events", ({ seq, events }) => {
		// A missing batch means missed events, so start again from a new snapshot.
		if (seq !== 0 && seq !== lastSeq.current + 1) return void watch();
		lastSeq.current = seq;
		for (const event of events) applyEvent(event);
	});

	function applyEvent(event: AgentEvent) {
		switch (event.type) {
			case "snapshot":
				return applySnapshot(event);
			case "run_start":
				return setRunning(true);
			case "run_end":
				return setRunning(false);
			case "tool_execution_start":
				return setTool(event.toolName);
			case "tool_execution_end":
				return setTool(null);
			case "message_start":
				if (event.message.role === "assistant") setStreaming(textOf(event.message));
				return;
			case "message_update":
				for (const change of event.changes) {
					if (change.type === "text_delta") setStreaming((text) => text + change.delta);
				}
				return;
			case "message_end":
				setStreaming("");
				setMessages((current) => [...current, ...toChatMessages(event.entry)]);
				return;
		}
	}

	return {
		messages,
		streaming,
		tool,
		running,
		ready: conn !== null && rootId !== null,
		// Starts a run without waiting for it. The events show the answer.
		send: (text: string) => {
			if (conn && rootId !== null) return conn.conversation.submit(rootId, { type: "input", content: text });
		},
		stop: () => {
			if (conn && rootId !== null) return conn.conversation.abort(rootId);
		},
	};
}

function toChatMessages(entry: EntryRecord): ChatMessage[] {
	return (entry.model ?? []).flatMap((message, index): ChatMessage[] => {
		if (message.role !== "user" && message.role !== "assistant") return [];
		const text = textOf(message);
		return text ? [{ id: `${entry.id}:${index}`, role: message.role, text }] : [];
	});
}

function textOf(message: UserMessage | AssistantMessage): string {
	if (typeof message.content === "string") return message.content;
	let text = "";
	for (const block of message.content) if (block.type === "text") text += block.text;
	return text;
}
