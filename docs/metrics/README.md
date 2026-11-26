# Phase 2 metrics

`generated.txt` is produced by `npm run metrics` (`scripts/metrics.mjs`). The script reads
the committed history (`git diff --numstat final..HEAD`, or `final..p2` once the tag exists)
and writes the report; no number is typed by hand.

Report contents:

- **Changed files and responsibilities** — status, line delta, inclusion scope, path, and the
  role of each Phase 2 file.
- **Line totals** — added/deleted/net lines split into `kernel`, `assembly`, and `plugins`.
  `CLI total` is the sum of those three. The VSCode extension is listed separately and is not
  part of the CLI total. Tests, docs, and tooling are tracked but not counted as product lines.
- **Cyclomatic complexity delta** — approximate per-file complexity at `final` and at the
  current head, computed as `1 + if/for/while/case/catch/&&/||/?:` after stripping comments and
  string literals. It is a lightweight estimate, not a CFG-based measurement.
- **Method** — the exact git commands and category rules used.

Excluded from line counts: `node_modules/`, `dist/`, `coverage/`, `package-lock.json`, and
binary image assets. Dependency and build directories are never committed.

To regenerate after moving the `p2` tag or adding a commit:

```sh
npm run metrics
```

`METRICS_BASE` and `METRICS_HEAD` can override the default range, for example
`METRICS_BASE=final METRICS_HEAD=p2 npm run metrics`.
