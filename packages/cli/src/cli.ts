#!/usr/bin/env node
/**
 * `aicl` — discover, document, and install AICL components.
 *
 *   aicl list
 *   aicl add button tabs
 *   aicl docs button
 *   aicl doctor
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { addItems } from './add.js';
import { findRepoRoot, itemPath, registryPath } from './repo.js';
import type { CatalogItem } from './types.js';

function help(): string {
  return `aicl — discover, document, and install AICL components

Usage:
  aicl list [--type ui|lib|hook|theme] [--json]
  aicl add <item...> [--dry-run] [--force] [--cwd dir]
  aicl docs <item>
  aicl doctor
  aicl help

A component is not incorporated until it is in the catalog, has a doc page,
and can be installed. \`aicl add\` copies source (D17) and prints the npm
import the protocol/system packages still use.
`;
}

interface RegistryIndex {
  items: CatalogItem[];
}

async function loadIndex(root: string): Promise<RegistryIndex> {
  return JSON.parse(await readFile(registryPath(root), 'utf8')) as RegistryIndex;
}

async function cmdList(args: string[], root: string): Promise<void> {
  const json = args.includes('--json');
  const typeFlag = args.find((a, i) => args[i - 1] === '--type');
  const index = await loadIndex(root);
  const items = typeFlag
    ? index.items.filter((item) => item.type === `registry:${typeFlag}`)
    : index.items;
  if (json) {
    process.stdout.write(`${JSON.stringify(items.map((item) => item.name))}\n`);
    return;
  }
  const width = Math.max(...items.map((item) => item.name.length), 4);
  process.stdout.write(`${items.length} items\n\n`);
  for (const item of items) {
    const kind = item.type.replace('registry:', '');
    process.stdout.write(`${item.name.padEnd(width)}  ${kind.padEnd(6)}  ${item.title} — ${item.description}\n`);
  }
}

async function cmdAdd(args: string[], root: string): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const cwdIndex = args.indexOf('--cwd');
  const cwd = cwdIndex >= 0 ? args[cwdIndex + 1] : undefined;
  const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--cwd');
  if (names.length === 0) {
    process.stderr.write('aicl add: pass one or more item names. Try `aicl list`.\n');
    process.exitCode = 1;
    return;
  }
  const result = await addItems(names, root, { dryRun, force, cwd });
  process.stdout.write(`items: ${result.items.join(', ')}\n`);
  for (const file of result.copied) {
    process.stdout.write(`${dryRun ? 'would copy' : 'copied'}  ${file.to}\n`);
  }
  for (const skipped of result.skipped) {
    process.stdout.write(`skipped   ${skipped} (exists; pass --force)\n`);
  }
  process.stdout.write('\nnpm import:\n');
  for (const line of result.npmImports) process.stdout.write(`  ${line}\n`);
  if (result.dependencies.length > 0) {
    process.stdout.write(`\nnpm dependencies: ${result.dependencies.join(', ')}\n`);
  }
}

async function cmdDocs(args: string[], root: string): Promise<void> {
  const name = args.find((a) => !a.startsWith('--'));
  if (!name) {
    process.stderr.write('aicl docs: pass an item name.\n');
    process.exitCode = 1;
    return;
  }
  const item = JSON.parse(await readFile(itemPath(name, root), 'utf8')) as CatalogItem;
  const page = join(root, item.docs);
  process.stdout.write(await readFile(page, 'utf8'));
}

async function cmdDoctor(root: string): Promise<void> {
  const cwd = process.cwd();
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')) as typeof pkg;
  } catch {
    process.stdout.write('no package.json in this directory\n');
    process.exitCode = 1;
    return;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const expected = [
    ['@aicl/core', 'the protocol. Versioned on npm.'],
    ['@aicl/react', 'the primitives. Or `aicl add <item>` for source.'],
    ['@aicl/styles', 'the token contract. `import \'@aicl/styles\'`.'],
    ['@aicl/motion', 'the springs. `import \'@aicl/motion/motion.css\'` after styles.'],
  ] as const;

  process.stdout.write(`doctor (${cwd})\n`);
  let missing = 0;
  for (const [name, note] of expected) {
    const have = deps[name];
    if (have) process.stdout.write(`  ok      ${name}  ${have}\n`);
    else {
      missing++;
      process.stdout.write(`  missing ${name}  — ${note}\n`);
    }
  }
  if (!deps['@aicl/fx']) {
    process.stdout.write('  optional @aicl/fx  — animated, Tailwind-coupled. `aicl list --type ui`\n');
  }
  process.stdout.write(
    missing
      ? `\n${missing} missing. Systems install as packages; components install as source (\`aicl add\`).\n`
      : '\nstack looks complete. Import styles, then motion, then a skin.\n',
  );
  if (missing) process.exitCode = 1;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(help());
    return;
  }
  const root = findRepoRoot();
  switch (command) {
    case 'list':
      await cmdList(args, root);
      break;
    case 'add':
      await cmdAdd(args, root);
      break;
    case 'docs':
      await cmdDocs(args, root);
      break;
    case 'doctor':
      await cmdDoctor(root);
      break;
    default:
      process.stderr.write(`unknown command "${command}". Try \`aicl help\`.\n`);
      process.exitCode = 1;
  }
}

await main(process.argv.slice(2));
