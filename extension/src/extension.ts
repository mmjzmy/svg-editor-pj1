import * as vscode from 'vscode';
import { parseOutline, type OutlineNode } from './outline';

class SvgOutline implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const text = document.getText();
    return parseOutline(text).map(node => this.toSymbol(document, node));
  }

  private toSymbol(document: vscode.TextDocument, node: OutlineNode): vscode.DocumentSymbol {
    const range = new vscode.Range(document.positionAt(node.start), document.positionAt(node.end));
    const symbol = new vscode.DocumentSymbol(
      node.label,
      node.tag,
      node.children.length ? vscode.SymbolKind.Struct : vscode.SymbolKind.Object,
      range,
      range,
    );
    symbol.children = node.children.map(child => this.toSymbol(document, child));
    return symbol;
  }
}

class SvgDecorationProvider implements vscode.FileDecorationProvider {
  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (!/\.svg$/i.test(uri.path)) return undefined;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if ((stat.type & vscode.FileType.File) === 0) return undefined;
    } catch {
      return undefined;
    }
    return { badge: '[]', tooltip: 'SVG document' };
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: 'svg', scheme: 'file' },
    { pattern: '**/*.svg', scheme: 'file' },
  ];
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new SvgOutline()));
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(new SvgDecorationProvider()));
  context.subscriptions.push(vscode.commands.registerCommand('svgOutline.refresh', () =>
    vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer')));

  const demo = vscode.workspace.getConfiguration('svgOutline').get<boolean>('demo') === true
    || (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SVG_OUTLINE_DEMO === '1';
  if (demo) {
    let done = false;
    const focusOutline = async (): Promise<void> => {
      if (done) return;
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      const activeIsSvg = vscode.window.activeTextEditor?.document.languageId === 'svg';
      const tabIsSvg = typeof tab?.label === 'string' && tab.label.toLowerCase().endsWith('.svg');
      if (!activeIsSvg && !tabIsSvg) return;
      done = true;
      try { await vscode.commands.executeCommand('workbench.action.reopenTextEditor'); } catch { /* already text */ }
      await new Promise(resolve => setTimeout(resolve, 800));
      try { await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar'); } catch { /* already closed */ }
      try { await vscode.commands.executeCommand('notifications.clearAll'); } catch { /* no notifications */ }
      await vscode.commands.executeCommand('workbench.view.explorer');
      await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
      await vscode.commands.executeCommand('outline.focus');
      try { await vscode.commands.executeCommand('outline.expand'); } catch { /* empty outline */ }
    };
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => { void focusOutline(); }));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(() => { void focusOutline(); }));
    const timer = setTimeout(() => { void focusOutline(); }, 2500);
    context.subscriptions.push({ dispose: () => clearTimeout(timer) });
  }
}

export function deactivate(): void {}
