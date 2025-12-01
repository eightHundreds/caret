import { Notice } from "obsidian";
import type CaretPlugin from "../../main";
import { getLongestLineage } from "../canvas/lineage";
import type { Node } from "../../types";

export async function buildConversation(
    plugin: CaretPlugin,
    node: Node,
    nodes: Node[],
    edges: any[],
    system_prompt: string,
    context_window: number
) {
    const longest_lineage = getLongestLineage(nodes, edges, node.id);

    const conversation: { role: string; content: string }[] = [];
    let local_system_prompt = system_prompt;
    let convo_total_tokens = 0;

    for (let i = 0; i < longest_lineage.length; i++) {
        const lineageNode = longest_lineage[i];

        let node_context = await plugin.getAssociatedNodeContent(lineageNode, nodes, edges);

        if (plugin.settings.include_nested_block_refs) {
            const block_ref_content = await plugin.getRefBlocksContent(node_context);
            if (block_ref_content.length > 0) {
                node_context += `\n${block_ref_content}`;
            }
        }

        const role = lineageNode.unknownData?.role || "";
        if (role === "user") {
            let content = lineageNode.text;
            if (lineageNode.type === "file" && (lineageNode as any).file) {
                const file = plugin.app.vault.getFileByPath((lineageNode as any).file);
                if (file) {
                    content = await plugin.app.vault.cachedRead(file);
                }
            }

            if (plugin.settings.include_nested_block_refs) {
                const block_ref_content = await plugin.getRefBlocksContent(content);
                if (block_ref_content.length > 0) {
                    content += `\n${block_ref_content}`;
                }
            }
            if (node_context.length > 0) {
                content += `\n${node_context}`;
            }

            if (content && content.length > 0) {
                const user_message_tokens = plugin.encoder.encode(content).length;
                if (user_message_tokens + convo_total_tokens > context_window) {
                    new Notice("Exceeding context window while adding user message. Trimming content");
                    break;
                }
                const message = {
                    role,
                    content,
                };
                if (message.content.length > 0) {
                    conversation.push(message);
                    convo_total_tokens += user_message_tokens;
                }
            }
        } else if (role === "assistant") {
            const content = lineageNode.text;
            const message = {
                role,
                content,
            };
            conversation.push(message);
        } else if (role === "system") {
            local_system_prompt = lineageNode.text;
        }
    }
    local_system_prompt = await plugin.getRefBlocksContent(local_system_prompt);
    conversation.reverse();
    if (local_system_prompt.length > 0) {
        conversation.unshift({ role: "system", content: local_system_prompt });
    }

    for (let i = 0; i < conversation.length - 1; i++) {
        if (conversation[i].role === "user" && conversation[i + 1].role === "user") {
            conversation.splice(i + 1, 0, { role: "assistant", content: "-" });
            i++;
        }
    }

    return { conversation };
}
