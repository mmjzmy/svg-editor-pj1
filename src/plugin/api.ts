import type { Editor } from '../application/Editor.js';
import type { ShapeProvider, AttributeHandler, TreeDecorator } from '../domain/ExtensionPoints.js';

export type { ShapeProvider, AttributeHandler, TreeDecorator, TreeDecoratorContext } from '../domain/ExtensionPoints.js';

export interface CommandPlugin {
  readonly name: string;
  readonly usage: string;
  execute(editor: Editor, args: string[]): string | Promise<string>;
}

/** Names a plugin provides, compared against its actual registrations by the loader. */
export interface PluginContributes {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributes?: readonly string[];
}

export interface PluginManifest extends PluginContributes {
  readonly name?: string;
  readonly contributes?: PluginContributes;
}

export interface PluginContext {
  readonly factory: { register(provider: ShapeProvider): void };
  readonly commands: { register(plugin: CommandPlugin): void };
  readonly tree: { register(decorator: TreeDecorator): void };
  readonly attributes: { register(handler: AttributeHandler): void };
  /** Present when the host has an editor; decorators may subscribe to save/load events. */
  readonly editor?: Editor;
}

export interface PluginModule {
  /** Runtime declaration. Category fields or a nested contributes object are both accepted. */
  readonly manifest?: PluginManifest;
  /** package.json-style declaration; takes precedence over manifest.contributes. */
  readonly contributes?: PluginContributes;
  activate(context: PluginContext, options?: Record<string, unknown>): void;
}
