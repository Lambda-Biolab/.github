# scripts

Tooling for the `.github` repo.

## `generate-social-previews.mjs`

Generates GitHub social-preview PNGs (1280×640) for every Lambda Biolab repo listed in [`../social-previews.json`](../social-previews.json).

### Usage

```bash
pnpm install
pnpm generate:previews              # → dist/<repo>.png
pnpm generate:previews:siblings     # → ../../<repo>/.github/social-preview.png
```

`--write-to-siblings` requires each target repo checked out next to this one. After regenerating, upload the result manually at each repo's *Settings → General → Social preview*.

### Flags

| Flag | Default | Purpose |
| ---- | ------- | ------- |
| `--write-to-siblings` | off | Write into sibling repo `.github/` dirs instead of `dist/` |
| `--only <repo>` | all | Generate a single repo |
| `--config <path>` | `social-previews.json` | Use a different config file |
| `--out-dir <path>` | `dist` | Override dist directory |

### Adding a new repo

1. Append an entry to [`../social-previews.json`](../social-previews.json) (`repo`, `title`, `subtitle`, `tagline`, `accent`).
2. Run `pnpm generate:previews:siblings --only <repo>`.
3. Commit the PNG in the target repo and upload via GitHub *Settings → General → Social preview*.
