import { Shape } from '../domain/Shape.js';
import type { Editor } from '../application/Editor.js';
import type { ShapeProvider, AttributeHandler } from '../domain/ExtensionPoints.js';
export type { ShapeProvider, AttributeHandler } from '../domain/ExtensionPoints.js';

export interface CommandPlugin { readonly name: string; readonly usage: string; execute(editor: Editor, args: string[]): string | Promise<string>; }
export interface TreeDecorator { readonly name: string; decorate(shape: Shape, line: string): string; }
export interface PluginContext {
  readonly factory: { register(provider: ShapeProvider): void };
  readonly commands: { register(plugin: CommandPlugin): void };
  readonly tree: { register(decorator: TreeDecorator): void };
  readonly attributes: { register(handler: AttributeHandler): void };
}
export interface PluginModule { readonly manifest: { name: string; shapes?: string[]; commands?: string[]; decorators?: string[]; attributes?: string[] }; activate(context: PluginContext, options?: Record<string, unknown>): void; }
