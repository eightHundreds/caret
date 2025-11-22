## Why
当前源码分散在仓库根目录与 `src/` 目录，入口、视图、模态框、LLM 调用等耦合在一起，构建入口与目录布局不一致，影响可维护性与后续模块扩展。

## What Changes
- 将插件入口、设置、LLM 调用、画布/工作流/聊天 UI、编辑器扩展等代码迁移至 `src/` 下按领域分区（core/services/ui/features/config/shared），并建立必要的索引导出。
- 调整 esbuild/tsconfig 等工具链入口与路径别名，使其以 `src/main.ts` 为入口并统一路径解析，避免遗留 `./src` 相对路径。
- 规范模块边界与共享类型/配置位置，降低跨层耦合，为后续功能迭代与测试铺路。
- 记录迁移任务与风险，确保 Obsidian 插件现有行为保持不变。

## Impact
- Affected specs: plugin-architecture (new)
- Affected code: main.ts, settings.ts, llm_calls.ts, caret_canvas.ts, components/, views/, modals/, editorExtensions/, src/default-setting.ts, src/types.ts, esbuild.config.mjs, tsconfig.json, manifest.json/package scripts
