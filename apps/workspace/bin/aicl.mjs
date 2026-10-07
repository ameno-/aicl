#!/usr/bin/env node
/**
 * aicl: drive the running AICL workspace from a shell, so external coding
 * agents (Claude Code, Codex, pi) share the canvas with the user.
 * Zero dependencies. Talks to GET /api/tools and POST /api/tools/:name.
 */
import { realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const HELP = `aicl [--url URL] [--json] <command>

  tools                       list tools and their parameters
  call <tool> '<json>'        run any tool with JSON params
  read                        scratch_read: every shape on the canvas
  view [--ids a,b] [--out f]  scratch_view: render to PNG (default aicl-view.png)
  add '<json shapes>'         scratch_add: JSON array of shapes (or {"shapes": [...]})
  screens                     list screen shapes (component "screen")
  open <address>              navigate the user (aicl:/canvas, aicl:/overview, ...)

URL defaults to $AICL_URL or http://127.0.0.1:5180.`;

/** Splits argv into flags and positionals. Flags: --url, --out, --ids take a value; --json, --help are boolean. */
export function parseArgs(argv) {
  const flags = { json: false, help: false };
  const positional = [];
  const valued = new Set(['url', 'out', 'ids']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (valued.has(name)) {
        const value = inline ?? argv[++i];
        if (value === undefined) throw new Error(`--${name} needs a value`);
        flags[name] = value;
      } else if (name === 'json' || name === 'help') flags[name] = true;
      else throw new Error(`Unknown flag --${name}`);
    } else positional.push(arg);
  }
  return { flags, command: positional[0], args: positional.slice(1) };
}

/** Turns a command into { tool, params }. Pure, for testing. */
export function plan(command, args, flags) {
  const parseJson = (raw, what) => {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${what} must be valid JSON (quote it for your shell).`);
    }
  };
  switch (command) {
    case 'call': {
      if (!args[0]) throw new Error("usage: aicl call <tool> '<json>'");
      return { tool: args[0], params: args[1] ? parseJson(args[1], 'params') : {} };
    }
    case 'read':
      return { tool: 'scratch_read', params: {} };
    case 'view':
      return { tool: 'scratch_view', params: flags.ids ? { ids: flags.ids.split(',').filter(Boolean) } : {} };
    case 'add': {
      if (!args[0]) throw new Error("usage: aicl add '<json shapes>'");
      const value = parseJson(args[0], 'shapes');
      return { tool: 'scratch_add', params: Array.isArray(value) ? { shapes: value } : value };
    }
    case 'screens':
      return { tool: 'scratch_read', params: {}, filter: 'screens' };
    default:
      return undefined;
  }
}

async function request(base, method, path, body) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new Error(`Cannot reach ${base} (${cause.cause?.code ?? cause.message}). Is the workspace running? Use --url or AICL_URL.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) throw new Error(`HTTP ${res.status}`);
  return data;
}

function compact(shape) {
  const bits = [`${shape.id} ${shape.component ?? shape.kind}`, `(${shape.x},${shape.y})`];
  if (shape.w !== undefined) bits.push(`${shape.w}x${shape.h}`);
  const label = shape.text ?? shape.title;
  if (label) bits.push(JSON.stringify(label.length > 60 ? label.slice(0, 57) + '...' : label));
  if (shape.from || shape.to) bits.push(`${shape.from ?? '?'} -> ${shape.to ?? '?'}`);
  return bits.join(' ');
}

export async function main(argv, out = (s) => console.log(s)) {
  const { flags, command, args } = parseArgs(argv);
  if (flags.help || !command) return out(HELP);
  const base = (flags.url ?? process.env['AICL_URL'] ?? 'http://127.0.0.1:5180').replace(/\/$/, '');

  if (command === 'tools') {
    const tools = await request(base, 'GET', '/api/tools');
    if (flags.json) return out(JSON.stringify(tools, null, 2));
    for (const t of tools) {
      const props = Object.keys(t.parameters?.properties ?? {});
      out(`${t.name}(${props.join(', ')})  ${String(t.description).split('\n')[0].slice(0, 100)}`);
    }
    return;
  }

  if (command === 'open') {
    if (!args[0]) throw new Error('usage: aicl open <address>');
    const res = await request(base, 'POST', '/api/navigate', { address: args[0] });
    if (res.error) throw new Error(res.error);
    return out(`opened ${args[0]}`);
  }

  const step = plan(command, args, flags);
  if (!step) throw new Error(`Unknown command "${command}". Run aicl --help.`);
  const res = await request(base, 'POST', `/api/tools/${encodeURIComponent(step.tool)}`, { params: step.params });
  if (res.error) throw new Error(res.error);
  if (flags.json) return out(JSON.stringify(res, null, 2));

  const lines = [];
  for (const part of res.content ?? []) {
    if (part.type === 'image') {
      const file = flags.out ?? (command === 'view' ? 'aicl-view.png' : `aicl-${step.tool}.png`);
      writeFileSync(file, Buffer.from(part.data, 'base64'));
      lines.push(`wrote ${file}`);
    } else if (part.type === 'text') {
      let text = part.text ?? '';
      try {
        const value = JSON.parse(text);
        if (Array.isArray(value) && value.every((s) => s && typeof s === 'object' && 'kind' in s)) {
          const shapes = step.filter === 'screens' ? value.filter((s) => s.component === 'screen') : value;
          text = shapes.length ? shapes.map(compact).join('\n') : '(no shapes)';
        } else if (value && Array.isArray(value.shapes) && value.source) {
          text = `(${value.source})\n${value.shapes.map(compact).join('\n')}`;
        } else text = JSON.stringify(value);
      } catch {
        /* plain text */
      }
      lines.push(text);
    }
  }
  out(lines.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`aicl: ${error.message}`);
    process.exit(1);
  });
}
