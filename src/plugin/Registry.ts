import type { AttributeHandler, CommandPlugin, TreeDecorator } from './api.js';
import type { Shape } from '../domain/Shape.js';
export class PluginRegistry {
  readonly commands = new Map<string, CommandPlugin>();
  readonly decorators: TreeDecorator[] = [];
  readonly attributes: AttributeHandler[] = [];
  registerCommand(plugin: CommandPlugin): void { if (this.commands.has(plugin.name)) throw new Error(`duplicate registration: commands/${plugin.name}`); this.commands.set(plugin.name, plugin); }
  registerDecorator(plugin: TreeDecorator): void { if (this.decorators.some(p => p.name === plugin.name)) throw new Error(`duplicate registration: decorators/${plugin.name}`); this.decorators.push(plugin); }
  registerAttribute(plugin: AttributeHandler): void { if (this.attributes.some(p => p.name === plugin.name)) throw new Error(`duplicate registration: attributes/${plugin.name}`); this.attributes.push(plugin); }
  find(shape: Shape, attr: string): AttributeHandler | undefined { return this.attributes.find(handler => handler.handles(shape, attr)); }
}
