## ADDED Requirements
### Requirement: Source Consolidation Under src
The plugin codebase SHALL be relocated under `src/` with feature-based subfolders (core, services, ui, features, config/shared) and no runtime TypeScript files at the repository root.

#### Scenario: Bundler entry uses src
- **WHEN** the plugin is built
- **THEN** the bundler entrypoint is inside `src` (e.g., `src/main.ts`) and no runtime TypeScript files remain at the repository root.

#### Scenario: Feature grouping
- **WHEN** adding or moving UI, services, or feature code
- **THEN** files reside in their dedicated subfolders under `src/` (e.g., views/modals/components under `src/ui/`, LLM and helpers under `src/services/`, canvas/workflow/editor extensions under `src/features/`).

### Requirement: Module Boundaries and Imports
The architecture SHALL enforce clear dependencies where UI depends on services/core/config/types, services/features depend on config/types/integrations, and shared types/config are centralized to avoid circular imports.

#### Scenario: Updated imports
- **WHEN** referencing shared types, settings, or service helpers after the move
- **THEN** imports use the new `src` paths or configured aliases (e.g., `@/services/llm`) without legacy `./src` segments or broken relative traversals.

#### Scenario: Layered dependencies
- **WHEN** new modules are added
- **THEN** UI modules do not import from feature/service internals directly, and lower layers (services/features) do not import UI components.

### Requirement: Tooling Alignment After Move
Build and tooling configuration SHALL align with the new `src` layout so development and packaging flows remain functional.

#### Scenario: Esbuild config
- **WHEN** running the build script
- **THEN** `esbuild.config.mjs` uses a `src` entrypoint and outputs the plugin bundle at the expected path (`main.js`) without missing-module errors.

#### Scenario: TypeScript config
- **WHEN** compiling or type-checking
- **THEN** `tsconfig` includes the new `src` directories (and any path aliases) so the project compiles without unresolved imports.
