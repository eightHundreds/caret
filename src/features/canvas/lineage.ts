import type CaretPlugin from "../../main";
import type { Edge, Node } from "../../types";

export function getLongestLineage(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
    const parentSet: { [id: string]: string[] } = {};
    const childSet: { [id: string]: string[] } = {};

    edges.forEach((edge) => {
        const { fromNode, toNode } = edge;
        if (!childSet[fromNode]) childSet[fromNode] = [];
        if (!parentSet[toNode]) parentSet[toNode] = [];
        childSet[fromNode].push(toNode);
        parentSet[toNode].push(fromNode);
    });

    const lineageStack = [];
    const visited = new Set<string>();
    const dfs = (nodeId: string): boolean => {
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        const node = nodes.find((node) => node.id === nodeId);
        if (!node) return false;
        if (!parentSet[nodeId] || parentSet[nodeId].length === 0) {
            lineageStack.push(node);
            return true;
        }
        for (const parentId of parentSet[nodeId]) {
            if (dfs(parentId)) {
                lineageStack.push(node);
                return true;
            }
        }
        return false;
    };

    dfs(nodeId);
    return lineageStack;
}

export async function highlightLineage(plugin: CaretPlugin) {
    await new Promise((resolve) => setTimeout(resolve, 200)); // Sleep for 200 milliseconds

    const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
    // @ts-ignore
    if (!canvas_view?.canvas) {
        return;
    }
    // @ts-ignore TODO: Type this better
    const canvas = canvas_view.canvas; // Assuming canvas is a property of the view

    const selection = canvas.selection;
    const selection_iterator = selection.values();
    const node = selection_iterator.next().value;
    if (!node) {
        return;
    }
    const nodes_iterator = canvas.nodes.values();
    const nodes_array = Array.from(nodes_iterator);
    const canvas_data = canvas.getData();
    const { edges, nodes } = canvas_data;
    const longest_lineage = await getLongestLineage(nodes, edges, node.id);

    // Create a set to track lineage node IDs for comparison
    const lineage_node_ids = new Set(longest_lineage.map((node) => node.id));

    // Iterate through all nodes in the longest lineage
    for (const lineage_node of longest_lineage) {
        const lineage_id = lineage_node.id;
        const lineage_color = lineage_node.color;
        // Only store and change the color if it's not already stored
        if (!plugin.selected_node_colors.hasOwnProperty(lineage_id)) {
            plugin.selected_node_colors[lineage_id] = lineage_color; // Store the current color with node's id as key
            const filtered_nodes = nodes_array.filter((node: Node) => node.id === lineage_id);
            filtered_nodes.forEach((node: Node) => {
                node.color = "4"; // Reset the node color to its original
                node.render(); // Re-render the node to apply the color change
            });
        }
    }

    // Reset and remove nodes not in the current lineage
    Object.keys(plugin.selected_node_colors).forEach((node_id) => {
        if (!lineage_node_ids.has(node_id)) {
            const original_color = plugin.selected_node_colors[node_id];
            const filtered_nodes = nodes_array.filter((node: Node) => node.id === node_id);
            filtered_nodes.forEach((node: Node) => {
                node.color = original_color; // Reset the node color to its original
                node.render(); // Re-render the node to apply the color change
            });
            delete plugin.selected_node_colors[node_id]; // Remove from tracking object
        }
    });
}

export function unhighlightLineage(plugin: CaretPlugin) {
    const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
    // @ts-ignore
    if (!canvas_view?.canvas) {
        return;
    }
    // @ts-ignore TODO: Type this better
    const canvas = canvas_view.canvas;
    const nodes_iterator = canvas.nodes.values();
    const nodes_array = Array.from(nodes_iterator);

    for (const node_id in plugin.selected_node_colors) {
        const filtered_nodes = nodes_array.filter((node: Node) => node.id === node_id);
        filtered_nodes.forEach((node: Node) => {
            node.color = plugin.selected_node_colors[node_id]; // Reset the node color to its original
            node.render(); // Re-render the node to apply the color change
        });
    }
    plugin.selected_node_colors = {}; // Clear the stored colors after resetting
}
