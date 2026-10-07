/**
 * Runs one applet server function in its own process.
 * stdin:  one JSON object { file, fn, args }
 * stdout: one JSON line { result } | { error }
 * Anything the function logs goes to stderr so stdout stays parseable.
 */
import { pathToFileURL } from 'node:url';

console.log = console.info = console.debug = (...args: unknown[]) => console.error(...args);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function reply(payload: { result: unknown } | { error: string }): Promise<void> {
  return new Promise((resolve) => process.stdout.write(JSON.stringify(payload) + '\n', () => resolve()));
}

try {
  const { file, fn, args } = JSON.parse(await readStdin()) as { file: string; fn: string; args?: unknown[] };
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const target = Object.prototype.hasOwnProperty.call(mod, fn) ? mod[fn] : undefined;
  if (typeof target !== 'function') throw new Error(`The server module has no exported function "${fn}".`);
  const result = await (target as (...a: unknown[]) => unknown)(...(Array.isArray(args) ? args : []));
  await reply({ result: result === undefined ? null : result });
} catch (cause) {
  const error = cause instanceof Error ? `${cause.message}${cause.stack ? '\n' + cause.stack.split('\n').slice(1, 4).join('\n') : ''}` : String(cause);
  await reply({ error });
}
process.exit(0);
