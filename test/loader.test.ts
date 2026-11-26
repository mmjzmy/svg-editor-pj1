import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from './support.js';

const dataUrl = (source: string): string => `data:text/javascript,${encodeURIComponent(source)}`;

test('loader rejects a manifest that differs from actual registrations and rolls back', async () => {
  const h = createHarness();
  const result = await h.loader.load({
    module: dataUrl(`export default {
      manifest: { name: 'mismatch', commands: ['declared'] },
      activate(ctx) { ctx.commands.register({ name: 'actual', usage: 'actual', execute() { return 'x'; } }); }
    }`),
  });
  assert.match(result[0]!, /^error: plugin manifest mismatch: mismatch/);
  assert.equal(h.registry.commands.size, 0);
});

test('loader reports duplicate registrations and rolls back only the failing plugin', async () => {
  const h = createHarness();
  const first = dataUrl(`export default {
    manifest: { name: 'first', commands: ['dup'] },
    activate(ctx) { ctx.commands.register({ name: 'dup', usage: 'dup', execute() { return 'first'; } }); }
  }`);
  const second = dataUrl(`export default {
    manifest: { name: 'second', commands: ['dup'], decorators: ['second-label'] },
    activate(ctx) {
      ctx.tree.register({ name: 'second-label', decorate(_shape, line) { return line; } });
      ctx.commands.register({ name: 'dup', usage: 'dup', execute() { return 'second'; } });
    }
  }`);
  assert.deepEqual(await h.loader.load({ module: first }), []);
  const result = await h.loader.load({ module: second });
  assert.deepEqual(result, ['error: duplicate registration: commands/dup']);
  assert.equal(h.registry.commands.size, 1);
  assert.equal(h.registry.commands.get('dup')!.execute(h.editor, []), 'first');
  assert.equal(h.registry.decorators.length, 0);
});

test('loader rolls back shape registrations after activation failure', async () => {
  const h = createHarness();
  const result = await h.loader.load({
    module: dataUrl(`export default {
      manifest: { name: 'shapefail', shapes: ['s1'] },
      activate(ctx) { ctx.factory.register({ name: 's1', create() { return null; } }); throw new Error('boom'); }
    }`),
  });
  assert.match(result[0]!, /^error: plugin failed to activate: shapefail \(boom\)$/);
  assert.equal(h.factory.has('s1'), false);
});

test('loader rolls back shapes after a post-activation manifest mismatch', async () => {
  const h = createHarness();
  const result = await h.loader.load({
    module: dataUrl(`export default {
      manifest: { name: 'shape-mismatch', shapes: ['declared'] },
      activate(ctx) { ctx.factory.register({ name: 'actual', create() { return null; } }); }
    }`),
  });
  assert.match(result[0]!, /^error: plugin manifest mismatch: shape-mismatch/);
  assert.equal(h.factory.has('actual'), false);
});

test('loader distinguishes a missing module from a broken module', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-loader-'));
  try {
    await writeFile(join(dir, 'broken.ts'), `import './missing-dependency.js';\nexport default { manifest: { name: 'broken' }, activate() {} };\n`, 'utf8');
    const h = createHarness();
    assert.deepEqual(await h.loader.load({ module: './missing.ts' }, dir), ['error: plugin not found: ./missing.ts']);
    const result = await h.loader.load({ module: './broken.ts' }, dir);
    assert.match(result[0]!, /^error: plugin failed to load: \.\/broken\.ts/);
    assert.doesNotMatch(result[0]!, /plugin not found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loader reads package.json contributes and uses the package name', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-plugin-pkg-'));
  try {
    await mkdir(join(dir, 'plugin'));
    await writeFile(join(dir, 'plugin', 'package.json'), JSON.stringify({
      name: '@test/mismatched-package',
      type: 'module',
      contributes: { commands: ['declared'] },
    }), 'utf8');
    await writeFile(join(dir, 'plugin', 'index.ts'), `export default {
      activate(ctx) { ctx.commands.register({ name: 'actual', usage: 'actual', execute() { return ''; } }); }
    };\n`, 'utf8');
    const h = createHarness();
    const result = await h.loader.load({ module: './plugin/index.ts' }, dir);
    assert.match(result[0]!, /^error: plugin manifest mismatch: @test\/mismatched-package/);
    assert.equal(h.registry.commands.size, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loader reports a missing default export', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-loader-'));
  try {
    await writeFile(join(dir, 'no-default.ts'), 'export const value = 1;\n', 'utf8');
    const h = createHarness();
    assert.deepEqual(await h.loader.load({ module: './no-default.ts' }, dir), ['error: plugin has no default export: ./no-default.ts']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('invalid plugin config starts with built-ins and loads nothing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-loader-'));
  try {
    for (const [name, body] of [
      ['bad-array.json', '{"plugins":{}}'],
      ['bad-module.json', '{"plugins":[{"module":""}]}'],
      ['bad-enabled.json', '{"plugins":[{"module":"./x","enabled":"yes"}]}'],
    ] as const) {
      const path = join(dir, name);
      await writeFile(path, body, 'utf8');
      const h = createHarness();
      assert.deepEqual(await h.loader.loadConfig(path), ['error: invalid plugin config']);
      assert.equal(h.registry.commands.size, 0);
      assert.equal(h.factory.has('box'), false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('config options are forwarded and enabled:false is skipped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-loader-'));
  try {
    const echo = dataUrl(`export default {
      manifest: { name: 'echo', commands: ['echo'] },
      activate(ctx, options) {
        ctx.commands.register({ name: 'echo', usage: 'echo', execute() { return String(options && options.value); } });
      }
    }`);
    const config = {
      plugins: [
        { module: echo, enabled: false, options: { value: 'off' } },
        { module: echo, options: { value: 'on' } },
      ],
    };
    const path = join(dir, 'plugins.json');
    await writeFile(path, JSON.stringify(config), 'utf8');
    const h = createHarness();
    assert.deepEqual(await h.loader.loadConfig(path), []);
    assert.equal(h.registry.commands.size, 1);
    assert.equal(h.registry.commands.get('echo')!.execute(h.editor, []), 'on');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('code assembly uses the same validation path', async () => {
  const h = createHarness();
  const module = {
    manifest: { name: 'inline', commands: ['inline'] },
    activate(ctx: { commands: { register(plugin: { name: string; usage: string; execute(): string }): void } }) {
      ctx.commands.register({ name: 'inline', usage: 'inline', execute: () => 'ok' });
    },
  };
  assert.deepEqual(await h.loader.loadModule(module, 'inline'), []);
  assert.equal(h.registry.commands.size, 1);
  assert.equal(h.registry.commands.get('inline')!.execute(h.editor, []), 'ok');
});
