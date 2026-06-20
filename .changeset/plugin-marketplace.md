---
"mattpocock-skills": minor
---

Publish the skills as a Claude Code plugin marketplace. Adds `.claude-plugin/marketplace.json` so the skills can be installed natively with `/plugin marketplace add myamafuj/mattpocock-skills` followed by `/plugin install mattpocock-skills@mattpocock`. Enriches `plugin.json` with version, description, author, homepage, repository, and license metadata.

The plugin version is sourced from `package.json` (bumped by changesets) and propagated into `plugin.json` and the marketplace entry by `scripts/sync-plugin-version.mjs`, which runs as part of the `version` script so the three never drift.
