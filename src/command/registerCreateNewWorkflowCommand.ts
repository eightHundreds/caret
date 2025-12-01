import type CaretPlugin from "../main";
import { LinearWorkflowEditor } from "../ui/views/workflowEditor";

export function registerCreateNewWorkflowCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "create-new-workflow",
        name: "Create new workflow",
        callback: () => {
            const leaf = plugin.app.workspace.getLeaf(true);
            const linearWorkflowEditor = new LinearWorkflowEditor(plugin, leaf);
            leaf.open(linearWorkflowEditor);
            plugin.app.workspace.revealLeaf(leaf);
        },
    });
}
