import type { AttributeHandler, CommandPlugin, TreeDecorator } from './api.js';
import type { Shape } from '../domain/Shape.js';

export interface PluginRegistrySnapshot {
  readonly commands: ReadonlyMap<string, CommandPlugin>;
  readonly decorators: readonly TreeDecorator[];
  readonly attributes: readonly AttributeHandler[];
}

export class PluginRegistry {
  readonly commands = new Map<string, CommandPlugin>();
  readonly decorators: TreeDecorator[] = [];
  readonly attributes: AttributeHandler[] = [];

  registerCommand(plugin: CommandPlugin): void {
    if (this.commands.has(plugin.name)) throw new Error(`duplicate registration: commands/${plugin.name}`);
    this.commands.set(plugin.name, plugin);
  }
  registerDecorator(plugin: TreeDecorator): void {
    if (this.decorators.some(p => p.name === plugin.name)) throw new Error(`duplicate registration: decorators/${plugin.name}`);
    this.decorators.push(plugin);
  }
  registerAttribute(plugin: AttributeHandler): void {
    if (this.attributes.some(p => p.name === plugin.name)) throw new Error(`duplicate registration: attributes/${plugin.name}`);
    this.attributes.push(plugin);
  }
  find(shape: Shape, attr: string): AttributeHandler | undefined {
    return this.attributes.find(handler => handler.handles(shape, attr));
  }
  snapshot(): PluginRegistrySnapshot {
    return { commands: new Map(this.commands), decorators: [...this.decorators], attributes: [...this.attributes] };
  }
  restore(snapshot: PluginRegistrySnapshot): void {
    this.commands.clear();
    for (const [name, command] of snapshot.commands) this.commands.set(name, command);
    this.decorators.splice(0, this.decorators.length, ...snapshot.decorators);
    this.attributes.splice(0, this.attributes.length, ...snapshot.attributes);
  }
}
