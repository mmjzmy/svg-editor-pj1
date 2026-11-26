import * as vscode from 'vscode';
import { DOMParser } from '@xmldom/xmldom';
class SvgOutline implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    try { const root = new DOMParser({ onError: () => { throw new Error('invalid XML'); } }).parseFromString(document.getText(), 'image/svg+xml').documentElement; if (!root) return []; const visit = (node: any): vscode.DocumentSymbol => { const id = node.getAttribute?.('id'); const label = id ? `${node.localName}#${id}` : node.localName; const line = Math.max(0, document.positionAt(document.getText().indexOf(`<${node.localName}`)).line); const symbol = new vscode.DocumentSymbol(label, node.localName, vscode.SymbolKind.Struct, new vscode.Range(line,0,line,Math.max(0,document.lineAt(line).text.length)), new vscode.Range(line,0,line,Math.max(0,document.lineAt(line).text.length))); symbol.children = Array.from(node.childNodes ?? []).filter((n: any) => n.nodeType === 1).map(visit); return symbol; }; return [visit(root)]; } catch { return []; }
  }
}
export function activate(context: vscode.ExtensionContext): void {
  const selector = { language: 'svg', scheme: 'file' };
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new SvgOutline()));
  context.subscriptions.push(vscode.commands.registerCommand('svgOutline.refresh', () => vscode.commands.executeCommand('workbench.action.files.openFile')));
  context.subscriptions.push(vscode.window.registerFileDecorationProvider({ provideFileDecoration(uri) { return uri.fsPath.toLowerCase().endsWith('.svg') ? { badge: '[]', tooltip: 'SVG document' } : undefined; } }));
}
export function deactivate(): void {}
