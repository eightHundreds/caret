import { MarkdownView, Notice } from "obsidian";
import type CaretPlugin from "../main";
import { LinearWorkflowEditor } from "../ui/views/workflowEditor";

export function registerEditWorkflowCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "edit-workflow",
        name: "Edit workflow",
        checkCallback: (checking: boolean) => {
            const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
            if (editor) {
                if (!checking) {
                    (async () => {
                        const current_file = plugin.app.workspace.getActiveFile();
                        const front_matter = await plugin.getFrontmatter(current_file);

                        if (front_matter.caret_prompt !== "linear" && front_matter.caret_prompt !== "parallel") {
                            new Notice("Not a workflow");
                            return;
                        }
                        const leaf = plugin.app.workspace.getLeaf(true);
                        const linearWorkflowEditor = new LinearWorkflowEditor(plugin, leaf, current_file?.path);
                        leaf.open(linearWorkflowEditor);
                        plugin.app.workspace.revealLeaf(leaf);
                    })();
                }
                return true;
            }
            return false;
        },
    });
}
