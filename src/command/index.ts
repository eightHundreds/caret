import type CaretPlugin from "../main";
import { registerApplyInlineChangesCommand } from "./registerApplyInlineChangesCommand";
import { registerCanvasPromptCommand } from "./registerCanvasPromptCommand";
import { registerContinueChatCommand } from "./registerContinueChatCommand";
import { registerCreateLinearWorkflowCommand } from "./registerCreateLinearWorkflowCommand";
import { registerCreateNewWorkflowCommand } from "./registerCreateNewWorkflowCommand";
import { registerEditWorkflowCommand } from "./registerEditWorkflowCommand";
import { registerInlineEditingCommand } from "./registerInlineEditingCommand";
import { registerToggleNestedBlockRefsCommand } from "./registerToggleNestedBlockRefsCommand";

export function registerCommands(plugin: CaretPlugin) {
    registerToggleNestedBlockRefsCommand(plugin);
    registerCreateNewWorkflowCommand(plugin);
    registerCreateLinearWorkflowCommand(plugin);
    registerCanvasPromptCommand(plugin);
    registerInlineEditingCommand(plugin);
    registerEditWorkflowCommand(plugin);
    registerApplyInlineChangesCommand(plugin);
    registerContinueChatCommand(plugin);
}
