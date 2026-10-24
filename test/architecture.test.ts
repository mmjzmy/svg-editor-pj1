import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename, posix } from 'node:path';

const allowed: Record<string, readonly string[]> = {
  domain: ['domain'],
  commands: ['commands', 'domain'],
  application: ['application', 'commands', 'domain'],
  cli: ['cli', 'application', 'commands', 'domain', 'presentation'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  presentation: ['presentation', 'domain'],
};

test('production imports follow architecture dependency rules and domain has no external IO', async () => {
  for (const [module, dependencies] of Object.entries(allowed)) {
    for (const file of await readdir(join('src', module))) {
      if (!file.endsWith('.ts')) continue;
      const source = await readFile(join('src', module, file), 'utf8');
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const imported = match[1]!;
        if (imported.startsWith('.')) {
          const target = posix.normalize(posix.join(module, imported)).split('/')[0]!;
          assert.ok(dependencies.includes(target), `${module}/${file} imports forbidden module ${target}`);
        } else if (['domain', 'commands', 'application', 'presentation'].includes(module)) {
          assert.fail(`${module}/${file} has external dependency ${imported}`);
        }
      }
      for (const match of source.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g)) {
        assert.equal(basename(file, '.ts'), match[1], `class/file mismatch in ${module}/${file}`);
      }
    }
  }
});
