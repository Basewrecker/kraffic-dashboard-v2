# Claude Code plugins: setting up another Mac

These are the user-level Claude Code plugins on the main design Mac, as of 2026-11-23, and the commands that install
the same set on another Mac.

## Where the list came from

- `~/.claude/plugins/installed_plugins.json` does not exist on this Mac.
- `~/.claude/settings.json` has no `enabledPlugins`. Neither does this repo's `.claude/settings.json`.
- `~/.claude/plugins/known_marketplaces.json` lists only one marketplace: `claude-plugins-official`
  (`anthropics/claude-plugins-official`).
- The plugins themselves are **synced from the Claude account** (claude.ai) into `~/.claude/plugins/synced/`. The
  list below comes from that folder's `manifest.json` and each plugin's own `.claude-plugin/plugin.json`.

**Quickest route:** sign in to Claude Code on the other Mac with the same Claude account. The account-synced plugins
then arrive by themselves. The commands below are for setting them up by hand, or on a different account.

## The plugins

| Plugin | Version | Marketplace (CLI name) | Source |
| --- | --- | --- | --- |
| frontend-design | 1.1.1 | claude-plugins-official | `anthropics/claude-plugins-official` |
| design | 1.2.0 | knowledge-work-plugins | `anthropics/knowledge-work-plugins` |
| cowork-plugin-management | 0.2.2 | knowledge-work-plugins | `anthropics/knowledge-work-plugins` |
| figma | 2.2.157 | knowledge-work-plugins | `anthropics/knowledge-work-plugins` |
| searchfit-seo | 1.0.0 | knowledge-work-plugins | `anthropics/knowledge-work-plugins` |
| ecc | 2.2.0 | ecc | `affaan-m/ECC` |
| audit-suite | 1.1.0 | orbit-plugin | `Recusive/Orbit-plugin` |
| vellum | 0.1.0 | applesnort | `applesnort/vellum` |
| hzblj-skills | 1.7.1 | hzblj | `hzblj/skills` |
| parallax-threejs | 0.4.12 | propersloth | `propersloth/parallax-threejs` |
| mcpmarket-me | 0.1.0 | claudeai-my-uploads | uploaded to the Claude account ("My Uploads") |

## Commands

Add the marketplaces:

```sh
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin marketplace add anthropics/knowledge-work-plugins
claude plugin marketplace add affaan-m/ECC
claude plugin marketplace add Recusive/Orbit-plugin
claude plugin marketplace add applesnort/vellum
claude plugin marketplace add hzblj/skills
claude plugin marketplace add propersloth/parallax-threejs
claude plugin marketplace add --claudeai claudeai-my-uploads
```

Install the plugins:

```sh
claude plugin install frontend-design@claude-plugins-official
claude plugin install design@knowledge-work-plugins
claude plugin install cowork-plugin-management@knowledge-work-plugins
claude plugin install figma@knowledge-work-plugins
claude plugin install searchfit-seo@knowledge-work-plugins
claude plugin install ecc@ecc
claude plugin install audit-suite@orbit-plugin
claude plugin install vellum@applesnort
claude plugin install hzblj-skills@hzblj
claude plugin install parallax-threejs@propersloth
claude plugin install mcpmarket-me@claudeai-my-uploads
```

## Notes

- The marketplace names after `@` come from each repo's `.claude-plugin/marketplace.json`, checked on 2026-11-23.
- `mcpmarket-me` was uploaded to the Claude account, so it has no GitHub marketplace. The `--claudeai` marketplace only
  works when signed in to the same account that uploaded it.
- `propersloth` also offers `parallax-threejs-npm` and `parallax-threejs-stable`. This Mac uses plain
  `parallax-threejs`.
- `figma` is in both `claude-plugins-official` and `knowledge-work-plugins`. This Mac gets it from
  `knowledge-work-plugins`.
- Installs get the marketplace's current version, which may be newer than the versions in the table.
- These commands haven't been run on a second Mac yet.
