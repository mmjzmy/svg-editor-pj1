import { Token } from './Token.js';

export class Tokenizer {
  tokenize(line: string): Token[] {
    if (!line.trim() || line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let value = ''; let quoted = false; let inQuotes = false; let active = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index]!;
      if (inQuotes && char === '\\') {
        const next = line[++index];
        if (next === undefined) throw new Error('unterminated quoted argument');
        const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
        value += escapes[next] ?? `\\${next}`;
      } else if (char === '"') {
        inQuotes = !inQuotes; quoted = true; active = true;
      } else if (!inQuotes && /\s/u.test(char)) {
        if (active) tokens.push(new Token(value, quoted));
        value = ''; active = false; quoted = false;
      } else {
        value += char; active = true;
      }
    }
    if (inQuotes) throw new Error('unterminated quoted argument');
    if (active) tokens.push(new Token(value, quoted));
    return tokens;
  }
}
