import type CaretPlugin from "../../main";
import { LinearWorkflowEditor } from "../../ui/views/workflowEditor";

export async function createLinearWorkflowFromCanvas(plugin: CaretPlugin, canvas: any) {
    const selection = canvas.selection;

    const selected_ids = [];
    const selection_iterator = selection.values();
    for (const node of selection_iterator) {
        selected_ids.push(node.id);
    }

    const { nodes, edges } = canvas;

    const selected_nodes = [];
    for (const node of nodes.values()) {
        if (selected_ids.includes(node.id)) {
            selected_nodes.push(node);
        }
    }

    const selected_edges = [];
    for (const edge of edges.values()) {
        if (selected_ids.includes(edge.to.node.id)) {
            selected_edges.push(edge);
        }
    }
    const linear_graph = [];
    for (let i = 0; i < selected_edges.length; i++) {
        const edge = selected_edges[i];
        const from_node = edge.from.node.id;
        const to_node = edge.to.node.id;
        linear_graph.push({ from_node, to_node });
    }
    const from_nodes = new Set(linear_graph.map((edge) => edge.from_node));
    const to_nodes = new Set(linear_graph.map((edge) => edge.to_node));

    let ultimate_ancestor = null;
    let ultimate_child = null;

    for (const from_node of from_nodes) {
        if (!to_nodes.has(from_node)) {
            ultimate_ancestor = from_node;
            break;
        }
    }

    for (const to_node of to_nodes) {
        if (!from_nodes.has(to_node)) {
            ultimate_child = to_node;
            break;
        }
    }
    const edge_map = new Map();
    for (const edge of linear_graph) {
        if (!edge_map.has(edge.from_node)) {
            edge_map.set(edge.from_node, []);
        }
        edge_map.get(edge.from_node).push(edge);
    }

    const sorted_graph = [];
    let current_node = ultimate_ancestor;

    while (current_node !== ultimate_child) {
        const edges_from_current = edge_map.get(current_node);
        if (edges_from_current && edges_from_current.length > 0) {
            const next_edge = edges_from_current[0];
            sorted_graph.push(next_edge);
            current_node = next_edge.to_node;
        } else {
            break;
        }
    }

    sorted_graph.push({ from_node: current_node, to_node: ultimate_child });
    const ordered_node_ids = [];

    ordered_node_ids.push(ultimate_ancestor);

    for (const edge of sorted_graph) {
        if (edge.to_node !== ultimate_child || ordered_node_ids[ordered_node_ids.length - 1] !== ultimate_child) {
            ordered_node_ids.push(edge.to_node);
        }
    }

    const prompts = [];

    for (const node_id of ordered_node_ids) {
        const node = selected_nodes.find((n) => n.id === node_id);
        if (node) {
            const context = node.text;
            if (node.unknownData.role === "user") {
                prompts.push(context.replace("<role>user</role>", "").trim());
            }
        }
    }

    const chat_folder_path = "caret/workflows";
    const chat_folder = plugin.app.vault.getAbstractFileByPath(chat_folder_path);
    if (!chat_folder) {
        plugin.app.vault.createFolder(chat_folder_path);
    }

    let prompts_string = ``;
    for (let i = 0; i < prompts.length; i++) {
        const escaped_content = plugin.escapeXml(prompts[i]);
        prompts_string += `

<prompt model="${plugin.settings.model}" provider="${plugin.settings.llm_provider}" delay="0" temperature="1">
${escaped_content}
</prompt>`.trim();
    }

    let file_content = `
---
caret_prompt: linear
version: 1
---
\`\`\`xml
<root>
<system_prompt tag="placeholder_do_not_delete">
</system_prompt>
    ${prompts_string}
</root>
\`\`\`
`.trim();

    let base_file_name = prompts[0]
        .split(" ")
        .slice(0, 10)
        .join(" ")
        .substring(0, 20)
        .replace(/[^a-zA-Z0-9]/g, "_");
    let file_name = `${base_file_name}.md`;
    let file_path = `${chat_folder_path}/${file_name}`;
    let counter = 1;

    while (plugin.app.vault.getFileByPath(file_path)) {
        file_name = `${base_file_name}_${counter}.md`;
        file_path = `${chat_folder_path}/${file_name}`;
        counter++;
    }

    plugin.app.vault.create(file_path, file_content).then(() => {
        const leaf = plugin.app.workspace.getLeaf(true);
        const linearWorkflowEditor = new LinearWorkflowEditor(plugin, leaf, file_path);
        leaf.open(linearWorkflowEditor);
        plugin.app.workspace.revealLeaf(leaf);
    });
}
