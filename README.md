# SVG Editor · PJ1 Phase 1

TypeScript 面向对象 CLI SVG 编辑器，支持六类图形、嵌套容器、SVG 文件读写和命令级撤销重做。

- [项目文档：架构、协作记录、一致性自查和质量保证](doc/README.md)
- [任务说明](phase_cli_1.md)
- [完整示例脚本](examples/flowchart.commands) · [生成的 SVG](examples/flowchart.svg)

## 运行

需要 Node.js 22 或更新版本。在项目根目录执行：

```sh
npm ci
npm run cli
```

```text
svg> init 800 600
svg> create g scene
svg> create rect r1 10 20 100 50 #4a90d9 in scene
svg> create text t1 30 50 "Hello SVG" in scene
svg> move scene 20 10
svg> undo
svg> tree
svg> save demo.svg
svg> exit
```

输入 `help` 查看全部命令。双引号用于带空格参数；支持整行 `#` 注释。`exit`、`quit` 或 EOF 退出。

执行脚本或运行编译版本：

```sh
npm run cli < examples/flowchart.commands
npm run build
node dist/main.js
```

## 验证

```sh
npm run check
npm run test:coverage
```

包含 59 项测试，覆盖领域行为、命令历史、CLI、真实文件读写、SVG 回环和架构依赖。GitHub Actions 在 Node.js 22 上运行检查。

本阶段不实现 `box` 插件、path 或完整 SVG 标准支持；外部 transform 保留但不做全局坐标换算，详细范围见项目文档。

## 提交

远程仓库：[mmjzmy/svg-editor-pj1](https://github.com/mmjzmy/svg-editor-pj1)（私有）。最终提交标记为 `final`。
