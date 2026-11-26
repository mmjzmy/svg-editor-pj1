# PJ1 Phase 2 测试与验证提交材料

## 插件与加载器测试

执行 `npm ci`、`npx tsc -p tsconfig.json`、`npm test`。结果为 **61 tests / 61 passed / 0 failed**。

`test/plugin.test.ts` 覆盖：

- 通过同一个 `PluginContext` 注册 `box` 和 `stats`；
- `ShapeProvider` 创建 box 及 `id-rect`、`id-label` 子部件；
- `AttributeHandler` 将 `fill` 传播到内部矩形、将 `label` 写入内部文本；
- `CommandPlugin` 注册、help 展示和 stats 执行；
- 缺失模块、激活异常、注册失败后的回滚；
- `DirectoryAccess` 适配器与真实文件系统组合。

## 功能兼容性验证

Phase 1 的 init/read/save/canvas、六类图形、move/scale、group/ungroup/addto、front/back、tree/show/help、undo/redo 和 SVG 读写回归测试全部通过。未加载可选插件时，内置命令继续可用，插件命令输出 `error: unknown command`。

配置装配验证：

```powershell
npx tsx src/main.ts --config plugins.config.json
```

示例：

```text
create box b 0 0 50 20 "Hi"
set b fill red
set b label "Hello"
stats
```

输出包含 `g#b (box)`、内部 rect/text，以及 `rect: 1  text: 1  (total 2, containers 1)`。

## VSCode 扩展验证

扩展源码在 `extension/src/extension.ts`。本机运行步骤：

```powershell
cd extension
npm install
npm run compile
code --extensionDevelopmentPath=. ..\examples\other.svg
```

验证项目：SVG 文件 badge 使用 `registerFileDecorationProvider` 返回 `[]`；Outline 使用 `registerDocumentSymbolProvider` 返回嵌套 `DocumentSymbol`；无 id 元素显示标签名；编辑和不完整 XML 不导致扩展崩溃。

## 复现命令

```powershell
npm ci
npx tsc -p tsconfig.json
npm test
npm run metrics
cd extension
npm install
npm run compile
```

依赖目录、编译产物和覆盖率目录不纳入提交。架构、ADR 和扩展点契约见 `doc/README.md` 与 `doc/adr/`。
