import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDirPlugin } from '../plugins/dir/index.js';
import { createHarness } from './support.js';

async function runTranscript(file: string, setup?: (harness: ReturnType<typeof createHarness>) => Promise<void>): Promise<void> {
  const commands = (await readFile(file, 'utf8'))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const expected = (await readFile(file.replace(/\.txt$/, '.expected.txt'), 'utf8'))
    .trimEnd()
    .split('\n---\n');
  const harness = createHarness();
  if (setup) await setup(harness);
  const outputs: string[] = [];
  for (const command of commands) outputs.push(await harness.cli.execute(command));
  assert.deepEqual(outputs, expected);
}

test('cli-1 transcript preserves the Phase 1 baseline without optional plugins', async () => {
  await runTranscript('doc/transcript/cli-1.txt');
});

test('cli-2 box transcript reproduces the Phase 1 6.1 box session', async () => {
  await runTranscript('doc/transcript/cli-2-box.txt', async harness => {
    assert.deepEqual(await harness.loader.load({ module: './plugins/box/index.ts' }), []);
  });
});

test('cli-3 transcript covers stats and dir', async () => {
  await runTranscript('doc/transcript/cli-3-new.txt', async harness => {
    assert.deepEqual(await harness.loader.load({ module: './plugins/stats/index.ts' }), []);
    assert.deepEqual(await harness.loader.loadModule(createDirPlugin({
      access: { list: async () => [{ name: 'sub', kind: 'directory' }, { name: 'a.txt', kind: 'file' }] },
      cwd: () => '/fixed',
    }), 'dir-fixed'), []);
  });
});
