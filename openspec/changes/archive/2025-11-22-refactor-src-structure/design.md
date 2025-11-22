## Context
- TypeScript 文件分散在根目录、views/modals/components、`src/`，入口为根目录 `main.ts`，构建入口与源码目录不一致。
- LLM 调用、画布逻辑、设置与 UI 彼此耦合，缺少分层与共享类型/配置的集中位置，路径中存在 `./src/...` 的交叉引用。

## Goals / Non-Goals
- Goals: 统一源码到 `src/`，明确分层（core/services/ui/features/config/shared），减少深层相对路径，保持 Obsidian 插件行为不变并提升可维护性。
- Non-Goals: 不新增功能或改变用户可见行为；不引入重大新依赖或重写 UI 交互。

## Decisions
- 入口与分层
  - `src/main.ts`: 插件 bootstrap、生命周期、命令注册与 Obsidian 桥接。
  - `src/core/`: 基础插件设施（设置加载/保存、命令/事件注册、解析器、frontmatter/文件访问帮助）。
  - `src/config/`: 默认设置、常量、manifest 相关配置、路径/命名约定。
  - `src/types/`: 域模型与共享类型，必要时提供 barrel `src/types/index.ts`。
  - `src/services/`: LLM 调用（`llm_calls.ts` 拆分为客户端与适配层）、AI/文本/文件处理 helper。
  - `src/features/`: 画布/工作流/编辑器扩展等功能模块（如 `caret_canvas.ts`、`editorExtensions`），可各自含内部子结构。
  - `src/ui/`: 视图、模态框、组件、设置面板（子目录 `views/`、`modals/`、`components/`、`settings/`），必要的样式/资源。
  - `src/integrations/`（可选）: Obsidian/外部 SDK 适配层，服务层通过接口调用。
- 导入策略
  - 在层内提供 barrel（如 `src/ui/index.ts`、`src/services/index.ts`）以减少相对路径深度。
  - 在 tsconfig 中配置 `baseUrl: "."` 与 `paths`（如 `@/*` 指向 `src/*`），淘汰 `./src/...` 形式。
  - 依赖方向：UI → services/core/config/types；services/features → core/config/types/integrations；避免 services 反向引用 UI。
- 构建与产物
  - esbuild 入口切换到 `src/main.ts`，输出仍为仓库根目录 `main.js` 以兼容 Obsidian。
  - 更新 tsconfig include/paths，确保工具链与新目录对齐。

## Risks / Trade-offs
- 文件移动可能引发相对路径或循环依赖问题 → 先建立 alias 与 barrel，再分批移动并借助编译检查。
- Obsidian 插件要求根目录产物 → 保持输出为 `main.js`，同时验证 manifest/sourcemap 兼容性。
- Barrel 可能掩盖依赖方向 → 在设计中明确分层，必要时避免在同层过度重导出。

## Migration Plan
- 建立目录框架与 tsconfig paths，添加必要的 barrel，确保现有代码可同时支持旧/新路径。
- 按层迁移（config/types → services/features → ui/core），每步修正导入并运行构建检查。
- 在完成迁移后清理遗留的根目录源码与无效路径，确保构建脚本仅引用 `src/`。

## Open Questions
- 是否需要在迁移后引入单元/集成测试以保护重构结果？
- 画布与工作流逻辑是否需要进一步拆分为独立 feature 子模块？
