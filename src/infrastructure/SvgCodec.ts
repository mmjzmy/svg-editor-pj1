import { DOMParser, DOMImplementation, XMLSerializer, type Element, type Document as XmlDocument } from '@xmldom/xmldom';
import { SvgDocument } from '../domain/SvgDocument.js';
import { Shape } from '../domain/Shape.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { Numbers } from '../domain/Numbers.js';

export class SvgCodec {
  static readonly namespace = 'http://www.w3.org/2000/svg';
  constructor(private readonly factory: ShapeFactory) {}

  decode(source: string): { document: SvgDocument; warnings: string[] } {
    const xml = new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
      .parseFromString(source, 'image/svg+xml');
    const root = xml.documentElement;
    if (!root || root.localName !== 'svg' || root.namespaceURI !== SvgCodec.namespace) {
      throw new Error('invalid SVG: expected <svg> root');
    }
    if (xml.doctype) throw new Error('invalid SVG: DOCTYPE is not supported');
    const rootAttributes = this.attributes(root);
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(value => Numbers.parse(value, 'viewBox'));
    if (viewBox && (viewBox.length !== 4 || viewBox[2]! <= 0 || viewBox[3]! <= 0)) {
      throw new Error('invalid viewBox');
    }
    const width = this.dimension(root.getAttribute('width'), viewBox?.[2] ?? 800, 'canvas width');
    const height = this.dimension(root.getAttribute('height'), viewBox?.[3] ?? 600, 'canvas height');
    delete rootAttributes.width; delete rootAttributes.height; delete rootAttributes.xmlns;
    const document = new SvgDocument(width, height, undefined, rootAttributes);
    const reserved = new Set<string>();
    // Reserve ALL explicit IDs before allocation, including IDs appearing later in the file.
    const reserve = (element: Element): void => {
      const id = element.getAttribute('id');
      if (id) {
        if (reserved.has(id)) throw new Error(`id already exists: ${id}`);
        reserved.add(id);
      }
      this.elements(element).forEach(reserve);
    };
    reserve(root);
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    const readShape = (element: Element): Shape => {
      if (element.namespaceURI !== SvgCodec.namespace) throw new Error(`unsupported namespace: ${element.namespaceURI}`);
      const type = element.localName ?? element.tagName;
      let id = element.getAttribute('id') ?? '';
      if (!id) {
        let sequence = counters.get(type) ?? 0;
        do { id = `${type}${++sequence}`; } while (reserved.has(id));
        counters.set(type, sequence); reserved.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
      }
      const shape = this.factory.fromAttributes(type, id, this.attributes(element), element.textContent ?? '');
      const children = this.elements(element);
      const group = shape.asContainer();
      if (children.length && !group) throw new Error(`unsupported child element in <${type}>`);
      if (group) children.forEach(child => group.insert(readShape(child)));
      return shape;
    };
    this.elements(root).forEach(element => document.add(readShape(element)));
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(SvgCodec.namespace, 'svg', null);
    const root = xml.documentElement!;
    root.setAttribute('xmlns', SvgCodec.namespace);
    root.setAttribute('width', String(document.width)); root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    for (const [key, value] of Object.entries(document.rootAttributes)) root.setAttribute(key, value);
    for (const shape of document.root.children) {
      root.appendChild(xml.createTextNode('\n  ')); root.appendChild(this.writeShape(xml, shape, 1));
    }
    if (document.root.children.length) root.appendChild(xml.createTextNode('\n'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(xml)}\n`;
  }

  private writeShape(xml: XmlDocument, shape: Shape, depth: number): Element {
    const element = xml.createElementNS(SvgCodec.namespace, shape.tag);
    for (const [key, value] of Object.entries(shape.attributes)) element.setAttribute(key, value);
    if (shape.textContent !== undefined) element.appendChild(xml.createTextNode(shape.textContent));
    for (const child of shape.children) {
      element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth + 1)}`));
      element.appendChild(this.writeShape(xml, child, depth + 1));
    }
    if (shape.children.length) element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
    return element;
  }
  private elements(parent: Element): Element[] {
    return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
  }
  private attributes(element: Element): Record<string, string> {
    return Object.fromEntries(Array.from(element.attributes, attr => [attr.name, attr.value]));
  }
  private dimension(value: string | null, fallback: number, label: string): number {
    return value === null ? fallback : Numbers.positive(Numbers.parse(value.replace(/px$/, ''), label), label);
  }
}
