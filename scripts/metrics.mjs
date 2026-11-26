import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.METRICS_BASE ?? 'final';
const HEAD = process.env.METRICS_HEAD ?? 'HEAD';
const RANGE = `${BASE}..${HEAD}`;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gitQuiet = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const gitOr = (args, fallback = '') => {
  try { return gitQuiet(args); } catch { return fallback; }
};

const baseSha = git(['rev-parse', '--short', `${BASE}^{commit}`]).trim();
const headSha = git(['rev-parse', '--short', `${HEAD}^{commit}`]).trim();
const headSubject = git(['log', '-1', '--format=%s', HEAD]).trim();

const EXCLUDED = [
  /^node_modules\//,
  /^dist\//,
  /^coverage\//,
  /(^|\/)package-lock\.json$/,
  /\.(png|jpe?g|gif|webp|ico)$/i,
];

const CATEGORIES = ['kernel', 'assembly', 'plugins', 'vscode', 'tests', 'docs', 'other'];

function category(path) {
  if (path.startsWith('extension/')) return 'vscode';
  if (path.startsWith('plugins/')) return 'plugins';
  if (path === 'src/main.ts' || path.startsWith('src/cli/') || path.startsWith('src/plugin/')) return 'assembly';
  if (path.startsWith('src/domain/') || path.startsWith('src/commands/')
    || path.startsWith('src/application/') || path.startsWith('src/presentation/')) return 'kernel';
  if (path.startsWith('test/')) return 'tests';
  if (path.startsWith('doc/') || path.startsWith('docs/') || path.startsWith('scripts/')) return 'docs';
  if (['package.json', 'plugins.config.json', 'tsconfig.json'].includes(path)) return 'assembly';
  return 'other';
}

const PURPOSE = {
  'src/domain/ExtensionPoints.ts': 'kernel-side extension interfaces',
  'src/plugin/api.ts': 'public plugin contract',
  'src/plugin/Registry.ts': 'registration tables and lookup',
  'src/plugin/PluginLoader.ts': 'module/config loading and rollback',
  'src/plugin/Directory.ts': 'directory access port + filesystem adapter',
  'src/cli/CommandDispatcher.ts': 'command dispatch and help',
  'src/commands/SetCommand.ts': 'attribute handler dispatch',
  'src/domain/ShapeFactory.ts': 'shape provider registration',
  'src/main.ts': 'composition root and assembly',
  'plugins/box.ts': 'box shape, attributes and label',
  'plugins/stats.ts': 'stats command',
  'plugins/dir.ts': 'dir command',
  'plugins/tree-star.ts': 'modified-star decorator',
  'plugins.config.json': 'configuration assembly',
  'scripts/metrics.mjs': 'metrics generator',
  'test/plugin.test.ts': 'plugin loader/integration tests',
  'test/architecture.test.ts': 'dependency boundary test',
  'extension/src/extension.ts': 'VSCode badge and outline providers',
  'extension/package.json': 'extension manifest',
};

function purpose(path) {
  if (PURPOSE[path]) return PURPOSE[path];
  if (path.startsWith('doc/adr/')) return 'architecture decision record';
  if (path.startsWith('docs/')) return 'submission evidence';
  if (path.startsWith('doc/')) return 'project documentation';
  return '-';
}

function isCounted(path) {
  return !EXCLUDED.some((pattern) => pattern.test(path));
}

function isCode(path) {
  return /\.(ts|js|mjs|cjs)$/.test(path);
}

function complexity(source) {
  if (!source) return 0;
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ');
  let score = 1;
  score += (text.match(/\b(?:if|for|while|case|catch)\b/g) ?? []).length;
  score += (text.match(/&&|\|\|/g) ?? []).length;
  score += (text.match(/\?(?!\.|\?)/g) ?? []).length;
  return score;
}

const numstat = git(['diff', '--numstat', '--no-renames', RANGE])
  .split('\n').filter(Boolean).map((line) => {
    const [added, deleted, ...rest] = line.split('\t');
    return {
      path: rest.join('\t'),
      added: added === '-' ? null : Number(added),
      deleted: deleted === '-' ? null : Number(deleted),
    };
  });

const statuses = new Map(git(['diff', '--name-status', '--no-renames', RANGE])
  .split('\n').filter(Boolean).map((line) => {
    const [status, ...rest] = line.split('\t');
    return [rest.join('\t'), status[0]];
  }));

const totals = new Map(CATEGORIES.map((name) => [name, { added: 0, deleted: 0, files: 0 }]));
const complexityTotals = new Map(CATEGORIES.map((name) => [name, { before: 0, after: 0, files: 0 }]));

const fileRows = [];
for (const file of numstat) {
  const cat = category(file.path);
  const counted = isCounted(file.path);
  const status = statuses.get(file.path) ?? '?';

  if (counted) {
    const total = totals.get(cat);
    total.files += 1;
    total.added += file.added ?? 0;
    total.deleted += file.deleted ?? 0;
  }

  if (counted && isCode(file.path)) {
    const before = complexity(gitOr(['show', `${BASE}:${file.path}`]));
    const after = complexity(gitOr(['show', `${HEAD}:${file.path}`]));
    const total = complexityTotals.get(cat);
    total.files += 1;
    total.before += before;
    total.after += after;
  }

  const lineStat = file.added === null ? 'bin' : `+${file.added}/-${file.deleted}`;
  fileRows.push([
    cat,
    status,
    lineStat,
    counted ? 'counted' : 'excluded',
    file.path,
    purpose(file.path),
  ]);
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function padStart(value, width) {
  return String(value).padStart(width);
}

function renderFileTable() {
  const header = ['category', 'st', 'lines', 'scope', 'path', 'purpose'];
  const rows = [header, ...fileRows];
  const widths = header.map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows.map((row) => row.map((cell, index) => index < 3 ? pad(cell, widths[index]) : pad(cell, widths[index])).join('  ').trimEnd()).join('\n');
}

function renderTotals() {
  const rows = [['category', 'files', 'added', 'deleted', 'net']];
  for (const name of CATEGORIES) {
    const total = totals.get(name);
    rows.push([name, total.files, total.added, total.deleted, total.added - total.deleted]);
  }
  const cli = ['CLI total', 0, 0, 0, 0];
  for (const name of ['kernel', 'assembly', 'plugins']) {
    const total = totals.get(name);
    cli[1] += total.files; cli[2] += total.added; cli[3] += total.deleted; cli[4] += total.added - total.deleted;
  }
  rows.push(cli);
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows.map((row) => row.map((cell, index) => index === 0 ? pad(cell, widths[index]) : padStart(cell, widths[index])).join('  ')).join('\n');
}

function renderComplexity() {
  const rows = [['category', 'files', 'final', 'head', 'delta']];
  for (const name of CATEGORIES) {
    const total = complexityTotals.get(name);
    rows.push([name, total.files, total.before, total.after, total.after - total.before]);
  }
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows.map((row) => row.map((cell, index) => index === 0 ? pad(cell, widths[index]) : padStart(cell, widths[index])).join('  ')).join('\n');
}

const output = `Phase 2 metrics (generated from git history)
Range: ${RANGE}
Base: ${baseSha}
Head: ${headSha} ${headSubject}
Generated: ${new Date().toISOString()}

== Changed files and responsibilities ==
${renderFileTable()}

== Line totals ==
Counted source/configuration only; dependency directories, build output, lock files,
and binary assets are excluded. VSCode is reported separately and is not part of the
CLI total. Tests and docs are tracked but not counted as CLI product lines.

${renderTotals()}

== Cyclomatic complexity delta (changed code files, approximate) ==
Complexity = 1 + count of if/for/while/case/catch/&&/||/?: per changed file, after
stripping comments and string literals. This is a lightweight estimate, not a full
CFG-based measurement.

${renderComplexity()}

== Method ==
- Line counts: git diff --numstat --no-renames ${RANGE}
- Change status: git diff --name-status --no-renames ${RANGE}
- Complexity: git show ${BASE}:<path> and git show ${HEAD}:<path>, then the regex
  counter above. New files count from 0; deleted files count to 0.
- Categories: kernel = src/domain,src/commands,src/application,src/presentation;
  assembly = src/main.ts,src/cli,src/plugin,root package/config files;
  plugins = plugins/; vscode = extension/ (separate); tests = test/; docs = doc,docs,scripts.
`;

mkdirSync('docs/metrics', { recursive: true });
writeFileSync('docs/metrics/generated.txt', output);
console.log(output);
