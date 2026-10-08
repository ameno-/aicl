#!/usr/bin/env node
/**
 * aicl-mcp: a stdio MCP server that proxies a running AICL workspace, so other
 * agents (Claude Code, Pi, …) use the same tools and surfaces as the in-app one.
 *
 *   tools      every agent tool from GET /api/tools, called via POST /api/tools/:name
 *              (gated tools such as terminal_run still ask the user in the AICL UI)
 *   resources  every open surface (GET /api/surfaces) as aicl://surface/<kind>/<id>
 *
 * Usage: node aicl-mcp.mjs [--url http://127.0.0.1:5180]   (or $AICL_URL)
 */
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_URL = 'http://127.0.0.1:5180';
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_=>])/g;

/** GET /api/tools entries → MCP tool descriptors. */
export function toMcpTools(apiTools) {
  return apiTools.map((t) => ({
    name: t.name,
    description: String(t.description ?? ''),
    inputSchema: t.parameters && t.parameters.type === 'object' ? t.parameters : { type: 'object', properties: {} },
  }));
}

/** POST /api/tools/:name response → MCP CallToolResult. */
export function toMcpResult(response) {
  if (response?.error) return { isError: true, content: [{ type: 'text', text: String(response.error) }] };
  const content = (response?.content ?? []).map((part) =>
    part.type === 'image' ? { type: 'image', data: part.data, mimeType: part.mimeType ?? 'image/png' } : { type: 'text', text: String(part.text ?? '') },
  );
  return { content: content.length ? content : [{ type: 'text', text: '(no output)' }] };
}

export const surfaceUri = (s) => `aicl://surface/${s.kind}/${encodeURIComponent(s.id)}`;

export function parseSurfaceUri(uri) {
  const m = /^aicl:\/\/surface\/([a-z]+)\/(.+)$/.exec(uri);
  return m ? { kind: m[1], id: decodeURIComponent(m[2]) } : null;
}

/** GET /api/surfaces entries → MCP resources. */
export function toMcpResources(surfaces) {
  return surfaces.map((s) => ({
    uri: surfaceUri(s),
    name: `${s.kind}: ${s.title}`,
    description: [s.summary, `status ${s.status}`].filter(Boolean).join(' — '),
    mimeType: 'text/plain',
  }));
}

export function parseArgs(argv) {
  let url = process.env['AICL_URL'] ?? DEFAULT_URL;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') url = argv[++i] ?? url;
    else if (a.startsWith('--url=')) url = a.slice(6);
    else throw new Error(`Unknown argument ${a}. Usage: aicl-mcp [--url ${DEFAULT_URL}]`);
  }
  return { url: url.replace(/\/$/, '') };
}

async function api(base, method, path, body) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new Error(`Cannot reach the AICL workspace at ${base} (${cause.cause?.code ?? cause.message}). Is it running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) throw new Error(`HTTP ${res.status} from ${path}`);
  return data;
}

/** The text an agent reads for one surface: its index entry plus live output where the kind has one. */
async function readSurface(base, ref) {
  const surfaces = (await api(base, 'GET', '/api/surfaces')).surfaces ?? [];
  const info = surfaces.find((s) => s.kind === ref.kind && s.id === ref.id);
  if (!info) throw new Error(`No open ${ref.kind} surface ${ref.id}.`);
  let output = '';
  const enc = encodeURIComponent(ref.id);
  if (ref.kind === 'terminal') output = (await api(base, 'GET', `/api/surfaces/terminal/${enc}/scrollback`)).data ?? '';
  else if (ref.kind === 'process') output = (await api(base, 'GET', `/api/surfaces/process/${enc}/logs?lines=200`)).data ?? '';
  return `${JSON.stringify(info, null, 2)}${output ? `\n\n--- output ---\n${String(output).replace(ANSI, '').replace(/\r/g, '')}` : ''}`;
}

export async function serve(base) {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

  const server = new Server({ name: 'aicl', version: '0.1.0' }, { capabilities: { tools: {}, resources: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toMcpTools(await api(base, 'GET', '/api/tools')) }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const res = await api(base, 'POST', `/api/tools/${encodeURIComponent(request.params.name)}`, { params: request.params.arguments ?? {} });
      return toMcpResult(res);
    } catch (cause) {
      return toMcpResult({ error: cause instanceof Error ? cause.message : String(cause) });
    }
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: toMcpResources((await api(base, 'GET', '/api/surfaces')).surfaces ?? []) }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const ref = parseSurfaceUri(request.params.uri);
    if (!ref) throw new Error(`Unknown resource ${request.params.uri}.`);
    return { contents: [{ uri: request.params.uri, mimeType: 'text/plain', text: await readSurface(base, ref) }] };
  });
  await server.connect(new StdioServerTransport());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    await serve(parseArgs(process.argv.slice(2)).url);
  } catch (error) {
    console.error(`aicl-mcp: ${error.message}`);
    process.exit(1);
  }
}
