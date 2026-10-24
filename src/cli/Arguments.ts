import { Token } from './Token.js';
import { Numbers } from '../domain/Numbers.js';

export class Arguments {
  constructor(private readonly tokens: readonly Token[], private readonly usage: string) {}
  count(min: number, max = min): this {
    if (this.tokens.length < min || this.tokens.length > max) throw new Error(`usage: ${this.usage}`);
    return this;
  }
  get length(): number { return this.tokens.length; }
  value(index: number): string {
    const token = this.tokens[index];
    if (!token) throw new Error(`usage: ${this.usage}`);
    return token.value;
  }
  number(index: number, label: string): number { return Numbers.parse(this.value(index), label); }
  values(start = 0, end = this.length): string[] { return this.tokens.slice(start, end).map(token => token.value); }
  get parentSuffix(): boolean {
    const token = this.tokens.at(-2);
    return token?.value === 'in' && !token.quoted;
  }
}
