## 1. Implementation
- [x] 1.1 盘点现有文件与依赖关系，确定 `src` 下的目标目录结构与入口（core/services/ui/features/config/shared）。目标：`src/main.ts` 入口；`src/config`（默认配置）；`src/types`（共享类型）；`src/services/llm.ts`；`src/features/canvas`、`src/features/editor`；`src/ui/{views,modals,components,settings}`。
- [x] 1.2 在 `src` 下创建分区与必要的 barrel/alias；迁移 main/settings/llm_calls/caret_canvas、views、modals、components、editorExtensions、默认配置与类型到对应子目录，必要时拆分子模块。
- [x] 1.3 统一导入路径（新增 paths alias 或区域索引），修复循环依赖；将共享类型、默认配置、常量集中到 `src/config` 或 `src/shared`。
- [x] 1.4 更新 esbuild、tsconfig、manifest/package 脚本的入口与输出路径，确保构建仍产出根目录 `main.js` 以兼容 Obsidian。
- [x] 1.5 运行构建或最小冒烟测试，确认 UI/命令/LLM 调用与工作流功能正常，记录验证结果与后续工作。
