#!/usr/bin/env node
// Single source of truth for the plugin version is package.json (bumped by changesets).
// This propagates that version into the plugin manifest and the marketplace entry so the
// three never drift. Runs automatically after `changeset version` (see the package.json
// "version" script and .github/workflows/release.yml).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const write = (rel, obj) =>
  writeFileSync(join(root, rel), JSON.stringify(obj, null, 2) + "\n");

const { version } = read("package.json");

const PLUGIN = ".claude-plugin/plugin.json";
const plugin = read(PLUGIN);
plugin.version = version;
write(PLUGIN, plugin);

const MARKETPLACE = ".claude-plugin/marketplace.json";
const marketplace = read(MARKETPLACE);
for (const entry of marketplace.plugins) {
  if (entry.name === plugin.name) entry.version = version;
}
write(MARKETPLACE, marketplace);

console.log(`Synced plugin version to ${version}`);
