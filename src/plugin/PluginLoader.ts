import { existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Editor } from '../application/Editor.js';
import type { PluginContext, PluginContributes, PluginModule } from './api.js';
import { PluginRegistry } from './Registry.js';
import type { PluginRegistrySnapshot } from './Registry.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';

export type PluginSpec = {
  module: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
};

const CATEGORIES = ['shapes', 'commands', 'decorators', 'attributes'] as const;
type Category = typeof CATEGORIES[number];
type Registered = Record<Category, string[]>;

const requireFromHere = createRequire(import.meta.url);

/**
 * Assembly-side loader. It knows only module specifiers, the public plugin
 * contract, and the registries; it never names a concrete plugin.
 */
export class PluginLoader {
  constructor(
    private readonly factory: ShapeFactory,
    private readonly registry: PluginRegistry,
    private readonly editor?: Editor,
  ) {}

  async loadConfig(path: string): Promise<string[]> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFileAsync(path, 'utf8')) as unknown;
    } catch {
      return ['error: invalid plugin config'];
    }
    const specs = this.parseConfig(raw);
    if (!specs) return ['error: invalid plugin config'];
    const result: string[] = [];
    for (const spec of specs) {
      if (spec.enabled === false) continue;
      result.push(...await this.load(spec, dirname(resolve(path))));
    }
    return result;
  }

  async load(spec: PluginSpec, base = process.cwd()): Promise<string[]> {
    const target = this.targetOf(spec.module, base);
    if (target === undefined) return [`error: plugin not found: ${spec.module}`];
    let mod: PluginModule;
    try {
      mod = (await import(target)).default as PluginModule;
    } catch (error) {
      return [`error: plugin failed to load: ${spec.module} (${message(error)})`];
    }
    if (!mod) return [`error: plugin has no default export: ${spec.module}`];
    return this.activateModule(mod, spec);
  }

  /** Code assembly path: activate an already-imported module through the same validation. */
  async loadModule(mod: PluginModule, label: string, options?: Record<string, unknown>): Promise<string[]> {
    return this.activateModule(mod, { module: label, options });
  }

  private async activateModule(mod: PluginModule, spec: PluginSpec): Promise<string[]> {
    const name = mod.manifest?.name ?? spec.module;
    const factorySnapshot = this.factory.snapshot();
    const registrySnapshot = this.registry.snapshot();
    const registered: Registered = { shapes: [], commands: [], decorators: [], attributes: [] };
    const context: PluginContext = {
      factory: { register: provider => { this.factory.register(provider); registered.shapes.push(provider.name); } },
      commands: { register: command => { this.registry.registerCommand(command); registered.commands.push(command.name); } },
      tree: { register: decorator => { this.registry.registerDecorator(decorator); registered.decorators.push(decorator.name); } },
      attributes: { register: handler => { this.registry.registerAttribute(handler); registered.attributes.push(handler.name); } },
      editor: this.editor,
    };
    try {
      await mod.activate(context, spec.options);
    } catch (error) {
      this.rollback(factorySnapshot, registrySnapshot);
      const reason = message(error);
      if (reason.startsWith('duplicate registration: ')) return [`error: ${reason}`];
      return [`error: plugin failed to activate: ${name} (${reason})`];
    }
    const declared = contributesOf(mod);
    if (!sameContributes(declared, registered)) {
      this.rollback(factorySnapshot, registrySnapshot);
      return [`error: plugin manifest mismatch: ${name} (declared: ${format(declared)}; registered: ${format(registered)})`];
    }
    return [];
  }

  private rollback(factorySnapshot: ReadonlyMap<string, unknown>, registrySnapshot: PluginRegistrySnapshot): void {
    this.factory.restore(factorySnapshot);
    this.registry.restore(registrySnapshot);
  }

  /**
   * Returns an import target only when the top-level module itself can be
   * located. A missing dependency inside an existing module is a load failure,
   * not a top-level "not found".
   */
  private targetOf(spec: string, base: string): string | undefined {
    if (spec.startsWith('data:') || spec.startsWith('http:')) return spec;
    if (spec.startsWith('.')) {
      const path = resolve(base, spec);
      if (!existsSync(path)) return undefined;
      return pathToFileURL(path).href;
    }
    if (spec.startsWith('file://')) {
      try {
        const path = fileURLToPath(spec);
        return existsSync(path) ? spec : undefined;
      } catch {
        return undefined;
      }
    }
    try {
      requireFromHere.resolve(spec);
      return spec;
    } catch {
      return undefined;
    }
  }

  private parseConfig(raw: unknown): PluginSpec[] | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const plugins = (raw as { plugins?: unknown }).plugins;
    if (!Array.isArray(plugins)) return undefined;
    const specs: PluginSpec[] = [];
    for (const item of plugins) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      if (typeof record.module !== 'string' || !record.module) return undefined;
      if (record.enabled !== undefined && typeof record.enabled !== 'boolean') return undefined;
      if (record.options !== undefined && (!record.options || typeof record.options !== 'object' || Array.isArray(record.options))) return undefined;
      specs.push({
        module: record.module,
        enabled: record.enabled as boolean | undefined,
        options: record.options as Record<string, unknown> | undefined,
      });
    }
    return specs;
  }
}

function contributesOf(mod: PluginModule): PluginContributes {
  if (mod.contributes) return mod.contributes;
  const manifest = mod.manifest;
  if (!manifest) return {};
  if (manifest.contributes) return manifest.contributes;
  return {
    shapes: manifest.shapes,
    commands: manifest.commands,
    decorators: manifest.decorators,
    attributes: manifest.attributes,
  };
}

function sameContributes(declared: PluginContributes, registered: Registered): boolean {
  for (const category of CATEGORIES) {
    const expected = new Set(declared[category] ?? []);
    const actual = new Set(registered[category]);
    if (expected.size !== actual.size || [...expected].some(name => !actual.has(name))) return false;
  }
  return true;
}

function format(contributes: PluginContributes | Registered): string {
  const source = contributes as Record<Category, readonly string[] | undefined>;
  return CATEGORIES.map(category => {
    const values = source[category] ?? [];
    return `${category}=${values.length ? values.join(',') : '[]'}`;
  }).join(', ');
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
