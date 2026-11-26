import { DOMParser } from '@xmldom/xmldom';

export interface OutlineNode {
  readonly tag: string;
  readonly id?: string;
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly children: OutlineNode[];
}

/**
 * Parses SVG text into a source-positioned outline. This module deliberately
 * has no vscode dependency so it can be tested with node:test.
 */
export function parseOutline(xml: string): OutlineNode[] {
  let failed = false;
  let document: any;
  try {
    document = new DOMParser({ locator: true, onError: () => { failed = true; } })
      .parseFromString(xml, 'image/svg+xml');
  } catch {
    return [];
  }
  if (failed || !document?.documentElement) return [];
  return [buildNode(xml, document.documentElement)];
}

function buildNode(xml: string, element: any): OutlineNode {
  const tag = element.localName ?? element.tagName;
  const id = element.getAttribute?.('id') || undefined;
  const start = offsetOf(xml, element);
  const children: OutlineNode[] = [];
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) children.push(buildNode(xml, child));
  }
  return {
    tag,
    id,
    label: id ? `${tag}#${id}` : tag,
    start,
    end: elementEnd(xml, start, tag, children),
    children,
  };
}

function offsetOf(xml: string, element: any): number {
  const line = element.lineNumber;
  const column = element.columnNumber;
  if (typeof line === 'number' && typeof column === 'number' && line >= 1 && column >= 1) {
    return lineColumnToOffset(xml, line, column);
  }
  const index = xml.indexOf(`<${element.localName ?? element.tagName}`);
  return index < 0 ? 0 : index;
}

function lineColumnToOffset(xml: string, line: number, column: number): number {
  if (line === 1) return Math.max(0, column - 1);
  let current = 1;
  for (let index = 0; index < xml.length; index++) {
    if (xml[index] !== '\n') continue;
    current++;
    if (current === line) return index + 1 + Math.max(0, column - 1);
  }
  return 0;
}

function elementEnd(xml: string, start: number, tag: string, children: readonly OutlineNode[]): number {
  const openEnd = startTagEnd(xml, start);
  if (openEnd < 0) return Math.min(xml.length, start + 1);
  if (/\/\s*>$/.test(xml.slice(start, openEnd))) return openEnd;
  const searchFrom = children.length ? children[children.length - 1]!.end : openEnd;
  const close = xml.indexOf(`</${tag}`, searchFrom);
  if (close < 0) return openEnd;
  const closeEnd = xml.indexOf('>', close);
  return closeEnd < 0 ? openEnd : closeEnd + 1;
}

function startTagEnd(xml: string, start: number): number {
  let quote: string | undefined;
  for (let index = start; index < xml.length; index++) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '>') return index + 1;
  }
  return -1;
}
