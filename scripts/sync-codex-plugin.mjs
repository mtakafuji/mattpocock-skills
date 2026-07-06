#!/usr/bin/env node
// Builds the Codex plugin package from the Claude plugin's published skill list.
// The source skills stay under skills/; plugins/mattpocock-skills is generated.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const writeJson = (rel, obj) =>
  writeFileSync(join(root, rel), JSON.stringify(obj, null, 2) + "\n");

const packageJson = readJson("package.json");
const claudePlugin = readJson(".claude-plugin/plugin.json");

const pluginName = "mattpocock-skills";
const pluginRoot = join(root, "plugins", pluginName);
const generatedSkillsRoot = join(pluginRoot, "skills");

const ACRONYMS = new Set(["prd", "tdd", "adr"]);

function toDisplayName(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) =>
      ACRONYMS.has(part)
        ? part.toUpperCase()
        : part[0].toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function parseFrontmatter(contents) {
  if (!contents.startsWith("---\n")) return null;
  const end = contents.indexOf("\n---", 4);
  if (end === -1) return null;
  const raw = contents.slice(4, end);
  const fields = new Map();
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) fields.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
  }
  return { end: end + "\n---".length, fields };
}

function normalizeSkillMd(contents) {
  return contents
    .replace(/^disable-model-invocation:\s*true\s*\n/m, "")
    .replace(/^disable_model_invocation:\s*true\s*\n/m, "");
}

function writeExplicitInvocationMetadata(skillRoot, skillName, description) {
  const agentsDir = join(skillRoot, "agents");
  mkdirSync(agentsDir, { recursive: true });
  const shortDescription =
    description.length > 120 ? `${description.slice(0, 117)}...` : description;
  const yaml = [
    "interface:",
    `  display_name: "${toDisplayName(skillName)}"`,
    `  short_description: "${shortDescription.replaceAll('"', '\\"')}"`,
    `  default_prompt: "Use ${skillName}."`,
    "policy:",
    "  allow_implicit_invocation: false",
    "",
  ].join("\n");
  writeFileSync(join(agentsDir, "openai.yaml"), yaml);
}

rmSync(pluginRoot, { recursive: true, force: true });
mkdirSync(generatedSkillsRoot, { recursive: true });
mkdirSync(join(pluginRoot, ".codex-plugin"), { recursive: true });

for (const skillPath of claudePlugin.skills) {
  const sourceSkillRoot = join(root, skillPath);
  const skillName = skillPath.split("/").at(-1);
  const targetSkillRoot = join(generatedSkillsRoot, skillName);

  if (!existsSync(join(sourceSkillRoot, "SKILL.md"))) {
    throw new Error(`Missing SKILL.md for ${skillPath}`);
  }

  cpSync(sourceSkillRoot, targetSkillRoot, {
    recursive: true,
    dereference: true,
    filter: (src) => !src.includes(`${relative(root, pluginRoot)}/`),
  });

  const skillMdPath = join(targetSkillRoot, "SKILL.md");
  const originalSkillMd = readFileSync(skillMdPath, "utf8");
  const parsed = parseFrontmatter(originalSkillMd);
  const wasExplicitOnly =
    /^disable-model-invocation:\s*true\s*$/m.test(originalSkillMd) ||
    /^disable_model_invocation:\s*true\s*$/m.test(originalSkillMd);

  writeFileSync(skillMdPath, normalizeSkillMd(originalSkillMd));

  if (wasExplicitOnly) {
    writeExplicitInvocationMetadata(
      targetSkillRoot,
      skillName,
      parsed?.fields.get("description") ?? `Use ${skillName}.`,
    );
  }
}

writeJson("plugins/mattpocock-skills/.codex-plugin/plugin.json", {
  name: pluginName,
  version: packageJson.version,
  description: claudePlugin.description,
  author: claudePlugin.author,
  homepage: claudePlugin.homepage,
  repository: claudePlugin.repository,
  license: claudePlugin.license,
  keywords: [
    "skills",
    "engineering",
    "tdd",
    "triage",
    "domain-modeling",
    "codex",
    "agents",
  ],
  skills: "./skills/",
  interface: {
    displayName: "Matt Pocock Skills",
    shortDescription: "Engineering and workflow skills for Codex.",
    longDescription:
      "Matt Pocock's agent skills for real engineering workflows: grilling, TDD, triage, codebase design, domain modeling, prototypes, PRDs, and handoffs.",
    developerName: "Matt Pocock",
    category: "Engineering",
    capabilities: ["Skills"],
    websiteURL: claudePlugin.homepage,
    defaultPrompt: [
      "Use ask-matt to choose the right workflow.",
      "Use tdd to build this test-first.",
      "Use grill-with-docs to clarify this change.",
    ],
  },
});

mkdirSync(join(root, ".agents", "plugins"), { recursive: true });
writeJson(".agents/plugins/marketplace.json", {
  name: "mattpocock-skills",
  interface: {
    displayName: "Matt Pocock Skills",
  },
  plugins: [
    {
      name: pluginName,
      source: {
        source: "local",
        path: "./plugins/mattpocock-skills",
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Engineering",
    },
  ],
});

console.log(`Synced Codex plugin package: ${relative(root, pluginRoot)}`);
