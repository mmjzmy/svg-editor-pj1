import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemDirectoryAccess } from '../src/plugin/Directory.js';
import type { DirectoryAccess, DirectoryEntry } from '../src/plugin/Directory.js';
import { createDirCommand, createDirPlugin, formatEntries } from '../plugins/dir.js';
import { createHarness } from './support.js';

const fake = (entries: readonly DirectoryEntry[]): DirectoryAccess => ({
  list: async () => [...entries],
});

test('formatEntries sorts directories, files and special entries separately', () => {
  const output = formatEntries([
    { name: 'zeta', kind: 'directory' },
    { name: 'b.txt', kind: 'file' },
    { name: 'link', kind: 'other' },
    { name: 'alpha', kind: 'directory' },
    { name: '.hidden', kind: 'file' },
    { name: 'a.txt', kind: 'file' },
  ]);
  assert.equal(output, [
    '[DIR]  alpha',
    '[DIR]  zeta',
    '[FILE] .hidden',
    '[FILE] a.txt',
    '[FILE] b.txt',
    '[OTHER] link',
  ].join('\n'));
  assert.equal(formatEntries([]), '(empty directory)');
});

test('dir command uses the injected access and cwd', async () => {
  let seen = '';
  const command = createDirCommand({
    access: { list: async path => { seen = path; return [{ name: 'a.txt', kind: 'file' }]; } },
    cwd: () => '/fixed',
  });
  assert.equal(await command.execute({} as never, []), '[FILE] a.txt');
  assert.equal(seen, '/fixed');
  await assert.rejects(async () => { await command.execute({} as never, ['extra']); }, /usage: dir/);
});

test('dir command preserves the adapter error message', async () => {
  const command = createDirCommand({
    access: { list: async path => { throw new Error(`cannot read directory: ${path}`); } },
    cwd: () => '/missing',
  });
  await assert.rejects(async () => { await command.execute({} as never, []); }, /cannot read directory: \/missing/);
});

test('filesystem adapter lists directories, files, hidden entries and empty directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-dir-'));
  try {
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'b.txt'), 'b', 'utf8');
    await writeFile(join(dir, 'a.txt'), 'a', 'utf8');
    await writeFile(join(dir, '.hidden'), 'h', 'utf8');
    const entries = await new FileSystemDirectoryAccess().list(dir);
    assert.equal(formatEntries(entries), [
      '[DIR]  sub',
      '[FILE] .hidden',
      '[FILE] a.txt',
      '[FILE] b.txt',
    ].join('\n'));

    const empty = await mkdtemp(join(tmpdir(), 'svg-dir-empty-'));
    try {
      assert.equal(formatEntries(await new FileSystemDirectoryAccess().list(empty)), '(empty directory)');
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dir reports a real read failure with the requested path', async () => {
  const missing = join(tmpdir(), `svg-dir-missing-${process.pid}-${Date.now()}`);
  await assert.rejects(new FileSystemDirectoryAccess().list(missing), new RegExp(`cannot read directory: .*${process.pid}`));
});

test('code and config assembly produce byte-identical dir output for the same directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-dir-same-'));
  const configPath = join(process.cwd(), `.tmp-dir-config-${process.pid}.json`);
  try {
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'b.txt'), 'b', 'utf8');
    await writeFile(join(dir, 'a.txt'), 'a', 'utf8');
    await writeFile(join(dir, '.hidden'), 'h', 'utf8');

    const code = createHarness();
    assert.deepEqual(await code.loader.loadModule(createDirPlugin({ cwd: () => dir }), 'dir-code'), []);
    const codeOutput = await code.cli.execute('dir');

    await writeFile(configPath, JSON.stringify({
      plugins: [{ module: './plugins/dir.ts', options: { cwd: dir } }],
    }), 'utf8');
    const config = createHarness();
    assert.deepEqual(await config.loader.loadConfig(configPath), []);
    const configOutput = await config.cli.execute('dir');

    assert.equal(codeOutput, configOutput);
    assert.match(codeOutput, /^\[DIR\]  sub$/m);
  } finally {
    await rm(configPath, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test('dir works before init and does not touch document or undo history', async () => {
  const h = createHarness();
  assert.deepEqual(await h.loader.loadModule(createDirPlugin({ access: fake([]), cwd: () => '/fixed' }), 'dir-empty'), []);
  assert.equal(await h.cli.execute('dir'), '(empty directory)');

  await h.cli.execute('init');
  await h.cli.execute('create rect r1 0 0 10 10');
  const before = await h.cli.execute('tree');
  assert.equal(await h.cli.execute('dir'), '(empty directory)');
  assert.equal(await h.cli.execute('tree'), before);
  await h.cli.execute('undo');
  assert.doesNotMatch(await h.cli.execute('tree'), /r1/);
  await h.cli.execute('redo');
  assert.match(await h.cli.execute('tree'), /r1/);
});

test('a failing dir leaves document and undo history intact', async () => {
  const h = createHarness();
  const failing: DirectoryAccess = { list: async path => { throw new Error(`cannot read directory: ${path}`); } };
  await h.loader.loadModule(createDirPlugin({ access: failing, cwd: () => '/missing' }), 'dir-fail');
  await h.cli.execute('init');
  await h.cli.execute('create rect r1 0 0 10 10');
  const before = await h.cli.execute('tree');
  assert.equal(await h.cli.execute('dir'), 'error: cannot read directory: /missing');
  assert.equal(await h.cli.execute('tree'), before);
  await h.cli.execute('undo');
  assert.doesNotMatch(await h.cli.execute('tree'), /r1/);
});
