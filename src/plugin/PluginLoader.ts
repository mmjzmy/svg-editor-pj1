import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginContext, PluginModule } from './api.js';
import { PluginRegistry } from './Registry.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';

export type PluginSpec = { module: string; enabled?: boolean; options?: Record<string, unknown> };
export class PluginLoader {
  constructor(private readonly factory: ShapeFactory, private readonly registry: PluginRegistry) {}
  async loadConfig(path: string): Promise<string[]> {
    let config: { plugins?: PluginSpec[] };
    try { config = JSON.parse(await readFile(path, 'utf8')) as { plugins?: PluginSpec[] }; if (!Array.isArray(config.plugins)) throw new Error(); }
    catch { return ['error: invalid plugin config']; }
    const result: string[] = [];
    for (const spec of config.plugins) { if (spec.enabled === false) continue; result.push(...await this.load(spec, dirname(resolve(path)))); }
    return result;
  }
  async load(spec: PluginSpec, base = process.cwd()): Promise<string[]> {
    let mod: PluginModule;
    try { const target = spec.module.startsWith('.') ? pathToFileURL(resolve(base, spec.module)).href : spec.module; mod = (await import(target)).default as PluginModule; }
    catch { return [`error: plugin not found: ${spec.module}`]; }
    if (!mod) return [`error: plugin has no default export: ${spec.module}`];
    const snapshot = { commands: new Map(this.registry.commands), decorators: [...this.registry.decorators], attributes: [...this.registry.attributes] };
    const context: PluginContext = {
      factory: this.factory,
      commands: { register: p => this.registry.registerCommand(p) },
      tree: { register: p => this.registry.registerDecorator(p) },
      attributes: { register: p => this.registry.registerAttribute(p) },
    };
    try { mod.activate(context, spec.options); }
    catch (error) { this.registry.commands.clear(); snapshot.commands.forEach((v,k)=>this.registry.commands.set(k,v)); this.registry.decorators.splice(0); this.registry.decorators.push(...snapshot.decorators); this.registry.attributes.splice(0); this.registry.attributes.push(...snapshot.attributes); return [`error: plugin failed to activate: ${mod.manifest?.name ?? spec.module} (${error instanceof Error ? error.message : String(error)})`]; }
    return [];
  }
}
