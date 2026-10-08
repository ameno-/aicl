// node-pty@1.1.0 ships its macOS prebuilt spawn-helper without the execute
// bit, so every spawn fails with "posix_spawnp failed". Restore it.
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const prebuilds = path.join(import.meta.dirname, '..', 'node_modules', 'node-pty', 'prebuilds');
if (existsSync(prebuilds)) {
  for (const dir of readdirSync(prebuilds)) {
    const helper = path.join(prebuilds, dir, 'spawn-helper');
    if (existsSync(helper)) chmodSync(helper, 0o755);
  }
}
