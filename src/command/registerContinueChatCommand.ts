import { MarkdownView, Notice } from "obsidian";
import type CaretPlugin from "../main";
import type { Message } from "../types";
import { FullPageChat } from "../ui/views/chat";

export function registerContinueChatCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "continue-chat",
        name: "Continue chat",
        callback: async () => {
            const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
            if (editor) {
                const active_file = plugin.app.workspace.getActiveFile();
                if (!active_file) {
                    new Notice("No active file to continue chat from");
                    return;
                }
                const active_file_name = active_file.name;
                let content = editor.getValue();

                const split = content.split("<root>");
                const first_half = split[1];
                const second_split = first_half.split("</root>");
                const text = `<root>${second_split[0].trim()}</root>`;

                let xml_object;

                if (text) {
                    xml_object = await plugin.parseXml(text);
                } else {
                    new Notice("No XML block found.");
                    return;
                }
                const convo_id = xml_object.root.metadata[0].id[0];
                const messages_from_xml = xml_object.root.conversation[0].message;
                const messages: Message[] = [];
                if (messages_from_xml) {
                    for (let i = 0; i < messages_from_xml.length; i++) {
                        const role = messages_from_xml[i].role[0];
                        const content = messages_from_xml[i].content[0];
                        messages.push({ role, content });
                    }
                }
                if (convo_id && messages) {
                    const leaf = plugin.app.workspace.getLeaf(true);
                    // @ts-ignore
                    const header_el = leaf.tabHeaderEl;
                    if (header_el) {
                        const title_el = header_el.querySelector(".workspace-tab-header-inner-title");
                        if (title_el) {
                            if (active_file_name) {
                                title_el.textContent = active_file_name;
                            } else {
                                title_el.textContent = "Caret chat";
                            }
                        }
                    }
                    const chatView = new FullPageChat(plugin, leaf, convo_id, messages);
                    leaf.open(chatView);
                    leaf.getDisplayText();
                    plugin.app.workspace.revealLeaf(leaf);
                } else {
                    new Notice("No valid chat data found in the current document.");
                }
            } else {
                new Notice("No active markdown editor found.");
            }
        },
    });
}
