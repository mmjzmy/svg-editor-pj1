import type { Arguments } from './Arguments.js';

export type CommandHandler = {
  readonly usage: string;
  readonly run: (args: Arguments) => string | Promise<string>;
};

/** Default command registry. Built-ins are registered here, plugins use PluginRegistry. */
export class CommandCatalog {
  readonly #handlers = new Map<string, CommandHandler>();

  register(name: string, usage: string, run: CommandHandler['run']): void {
    if (this.#handlers.has(name)) throw new Error(`duplicate command: ${name}`);
    this.#handlers.set(name, { usage, run });
  }

  get(name: string): CommandHandler | undefined { return this.#handlers.get(name); }

  usages(): string[] { return [...this.#handlers.values()].map(handler => handler.usage); }
}
