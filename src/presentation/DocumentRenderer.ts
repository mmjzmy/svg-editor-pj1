import { SvgDocument } from '../domain/SvgDocument.js';
import { Shape } from '../domain/Shape.js';

export class DocumentRenderer {
  tree(document: SvgDocument, id?: string): string {
    const lines: string[] = [];
    const branch = (shape: Shape, prefix: string, last: boolean): void => {
      lines.push(`${prefix}${last ? '└── ' : '├── '}${shape.summary()}`);
      shape.children.forEach((child, index, children) => branch(child, `${prefix}${last ? '    ' : '│   '}`, index === children.length - 1));
    };
    if (id !== undefined) {
      const shape = document.find(id); lines.push(shape.summary());
      shape.children.forEach((child, index, children) => branch(child, '', index === children.length - 1));
    } else {
      lines.push(`svg (${document.width}x${document.height})`);
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
