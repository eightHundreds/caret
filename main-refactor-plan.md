# main.ts 重构计划

## 背景与目标
- `src/main.ts` 目前 ~2500 行，集成插件生命周期、命令注册、Canvas 交互、工作流、聊天/LLM 调用、文件与 UI 入口，职责混杂。
- 目标：让 `main.ts` 仅保留生命周期与注册入口，其他逻辑按领域拆分，降低耦合、便于维护与扩展。

## 拆分模块建议
- `src/command/`：已迁出的命令注册集中入口，后续新命令仅在此目录新增文件并在 `index.ts` 注册。
- `src/features/canvas/`：
  - `menuPatch.ts`：`patchCanvasMenu`、菜单按钮（`addNewNodeButton`/`add_sparkle_button`/`addExtraActions`）。
  - `lineageHighlight.ts`：`highlightLineage`、`unhighlightLineage`。
  - 如有节点创建/拆分通用操作，可放 `canvasOps.ts`。
- `src/features/workflow/`：
  - `linearWorkflow.ts`：线性工作流文件生成、命名、打开编辑器（供 create-linear-workflow 命令）。
  - `workflowEditorLauncher.ts`：新建/编辑工作流的 leaf 打开逻辑。
- `src/features/chat/`：
  - `conversationBuilder.ts`：`buildConversation`、系统提示插入、上下文裁剪。
  - `chatResume.ts`：从 Markdown/XML 恢复对话（continue-chat）。
  - `streaming.ts`：`sparkle`、`update_node_content_streaming`、LLM 调用封装。
- `src/ui/`：
  - `ribbon.ts`：`addChatIconToRibbon` 等 UI 入口。
  - 其他通用弹窗/按钮辅助可集中。
- `src/utils/`：
  - `file.ts`：`getFrontmatter`、`getChatLog`、`extractTextFromPDF` 等文件/FS 工具。
  - `string.ts`：`escapeXml` 等通用文本处理。

## 迁移顺序（渐进式，确保可回退）

2) **Canvas 相关**：先移 `lineageHighlight`，再移 `patchCanvasMenu` 及按钮逻辑，保持对 `CaretPlugin` 的参数注入。
3) **Workflow**：将 linear 工作流生成/编辑逻辑移动到 `features/workflow`，命令文件改用新模块。
4) **Chat/LLM**：拆出对话构建、流式更新、聊天恢复等，命令与业务调用通过新封装。
5) **UI & Utils**：提炼 `addChatIconToRibbon` 等 UI 入口；通用工具放 `utils`。
6) **清理 main.ts**：删除不再使用的 import，仅保留生命周期、设置页注册、命令入口与各模块初始化调用。

## 风险与验证
- 避免循环依赖：功能模块只依赖工具/类型，不反向 import `main`.
- 依赖 `this` 的方法改为显式传参或用对象封装，防止上下文丢失。
- 每步迁移后运行构建/类型检查（如 `pnpm build` 或等效命令）确保编译通过；关键命令/Canvas/聊天路径做一次冒烟。
