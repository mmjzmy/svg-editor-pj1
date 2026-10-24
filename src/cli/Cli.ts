import { createInterface } from 'node:readline';
import { CommandDispatcher } from './CommandDispatcher.js';

export class Cli {
  constructor(private readonly dispatcher: CommandDispatcher) {}
  async run(): Promise<void> {
    const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    const lines = createInterface({ input: process.stdin, output: process.stdout, terminal, crlfDelay: Infinity });
    if (terminal) {
      console.log("svg-editor 0.1 — type 'help' for commands");
      lines.setPrompt('svg> '); lines.prompt();
    }
    try {
      for await (const line of lines) {
        const output = await this.dispatcher.execute(line);
        if (output) console.log(output);
        if (this.dispatcher.shouldExit) break;
        if (terminal) lines.prompt();
      }
    } finally { lines.close(); }
  }
}
