import { SvgDocument } from '../domain/SvgDocument.js';
import { Shape } from '../domain/Shape.js';
import type { TreeDecorator } from '../domain/ExtensionPoints.js';

export class DocumentRenderer {
  tree(document: SvgDocument, id?: string, decorators: readonly TreeDecorator[] = []): string {
    const decorate = (shape: Shape, line: string, isRoot: boolean): string => {
      let text = line;
      for (const decorator of decorators) text = decorator.decorate(shape, text, { document, isRoot });
      return text;
    };
    const lines: string[] = [];
    const branch = (shape: Shape, prefix: string, last: boolean): void => {
      lines.push(`${prefix}${last ? '└── ' : '├── '}${decorate(shape, shape.summary(), false)}`);
      shape.children.forEach((child, index, children) => branch(child, `${prefix}${last ? '    ' : '│   '}`, index === children.length - 1));
    };
    if (id !== undefined) {
      const shape = document.find(id); lines.push(decorate(shape, shape.summary(), false));
      shape.children.forEach((child, index, children) => branch(child, '', index === children.length - 1));
    } else {
      lines.push(decorate(document.root, `svg (${document.width}x${document.height})`, true));
      document.root.children.forEach((child, index, children) => branch(child, '', index === children.length - 1));
    }
    return lines.join('\n');
  }
  show(document: SvgDocument, id: string): string {
    const shape = document.find(id); const parent = document.parent(shape);
    const lines = [`${shape.label}  parent=${parent === document.root ? 'svg' : parent.label}`];
    for (const [key, value] of Object.entries(shape.attributes)) {
      if (key !== 'id') lines.push(`  ${key}=${JSON.stringify(value)}`);
    }
    if (shape.textContent !== undefined) lines.push(`  text=${JSON.stringify(shape.textContent)}`);
    return lines.join('\n');
  }
}
