import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDirPlugin } from '../plugins/dir.js';
import { createHarness } from './support.js';

test('code and config assembly produce byte-identical output for a mixed session', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'svg-assembly-'));
  const configPath = join(process.cwd(), `.tmp-assembly-config-${process.pid}.json`);
  try {
    await mkdir(join(fixture, 'nested'));
    await writeFile(join(fixture, 'a.txt'), 'a', 'utf8');
    await writeFile(join(fixture, '.hidden'), 'h', 'utf8');

    const script = [
      'init 640 360',
      'create g flow',
      'create rect r1 10 20 40 30 in flow',
      'create box b 100 20 80 30 "B" in flow',
      'set b fill red',
      'set b label "Box"',
      'stats',
      'dir',
      'tree',
      'save out.svg',
    ];

    const code = createHarness();
    assert.deepEqual(await code.loader.load({ module: './plugins/box.ts' }), []);
    assert.deepEqual(await code.loader.load({ module: './plugins/stats.ts' }), []);
    assert.deepEqual(await code.loader.loadModule(createDirPlugin({ cwd: () => fixture }), 'dir-code'), []);
    assert.deepEqual(await code.loader.load({ module: './plugins/tree-star.ts' }), []);
    const codeOutput: string[] = [];
    for (const line of script) codeOutput.push(await code.cli.execute(line));

    await writeFile(configPath, JSON.stringify({
      plugins: [
        { module: './plugins/box.ts' },
        { module: './plugins/stats.ts' },
        { module: './plugins/dir.ts', options: { cwd: fixture } },
        { module: './plugins/tree-star.ts' },
      ],
    }), 'utf8');
    const config = createHarness();
    assert.deepEqual(await config.loader.loadConfig(configPath), []);
    const configOutput: string[] = [];
    for (const line of script) configOutput.push(await config.cli.execute(line));

    assert.deepEqual(configOutput, codeOutput);
    assert.match(configOutput.join('\n'), /g#b \(box\) \*/);
    assert.match(configOutput.join('\n'), /rect: 2  text: 1  \(total 3, containers 2\)/);
    assert.match(configOutput.join('\n'), /\[DIR\]  nested/);
  } finally {
    await rm(configPath, { force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});
