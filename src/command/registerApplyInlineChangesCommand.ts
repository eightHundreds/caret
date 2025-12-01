import { MarkdownView, Notice } from "obsidian";
import type CaretPlugin from "../main";

export function registerApplyInlineChangesCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "apply-inline-changes",
        name: "Apply inline changes",
        checkCallback: (checking: boolean) => {
            const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

            if (editor) {
                if (!checking) {
                    let content = editor.getValue();
                    // Regex to find |-content-|
                    // @ts-ignore
                    const deleteRegex = /\|-(.*?)-\|/gs;

                    // Replace all instances of |-content-| with empty string
                    content = content.replace(deleteRegex, "");
                    // Replace all instances of |+content+| with empty string
                    content = content.replace(/\|\+/g, "");
                    content = content.replace(/\+\|/g, "");

                    // Set the modified content back to the editor
                    editor.setValue(content);
                    new Notice("Diffs applied successfully.");
                }
                return true;
            }
            return false;
        },
    });
}
