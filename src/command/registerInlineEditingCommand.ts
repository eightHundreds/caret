import { MarkdownView } from "obsidian";
import type CaretPlugin from "../main";
import { CMDJModal } from "../ui/modals/inlineEditingModal";

export function registerInlineEditingCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "inline-editing",
        name: "Inline editing",
        checkCallback: (checking: boolean) => {
            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
                const selectedText = activeView.editor.getSelection();
                if (selectedText) {
                    if (!checking) {
                        const content = activeView.editor.getValue();
                        const startIndex = content.indexOf(selectedText);
                        const endIndex = startIndex + selectedText.length;
                        new CMDJModal(plugin.app, selectedText, startIndex, endIndex, plugin).open();
                    }
                    return true;
                }
            }
            return false;
        },
    });
}
