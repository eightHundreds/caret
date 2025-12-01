import type CaretPlugin from "../../main";
import type { Canvas, CanvasFileData, CanvasTextData, NewNode } from "../../types";
import type { StreamTextResult, CoreTool } from "ai";

export async function updateNodeContentStreaming(
    plugin: CaretPlugin,
    node_id: string,
    stream: StreamTextResult<Record<string, CoreTool<any, any>>, never>
) {
    const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
    // @ts-ignore
    if (!canvas_view?.canvas) {
        return;
    }
    const canvas: Canvas = (canvas_view as any).canvas;
    const nodes_iterator = canvas.nodes.values();
    let node = null;
    for (const node_objs of nodes_iterator) {
        if (node_objs.id === node_id) {
            node = node_objs;
            break;
        }
    }
    if (!node) return;
    node.width = 510;
    for await (const textPart of stream.textStream) {
        const current_text = node.text;
        let processed_text = textPart;
        if (textPart === "<think>") {
            processed_text = "<|think>";
        } else if (textPart.trim() === "</think>") {
            processed_text = "<|/think>";
        }
        const new_content = `${current_text}${processed_text}`;
        const word_count = new_content.split(/\s+/).length;
        const number_of_lines = Math.ceil(word_count / 7);
        if (word_count > 500) {
            node.width = 750;
            node.height = Math.max(200, number_of_lines * 35);
        } else {
            node.height = Math.max(200, number_of_lines * 45);
        }

        node.setText(new_content);
        node.render();
    }
}

export async function updateNodeContent(plugin: CaretPlugin, node_id: string, content: string) {
    const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
    // @ts-ignore
    if (!canvas_view?.canvas) {
        return;
    }
    const canvas: Canvas = (canvas_view as any).canvas;

    const nodes_iterator = canvas.nodes.values();
    let node = null;
    for (const node_objs of nodes_iterator) {
        if (node_objs.id === node_id) {
            node = node_objs;
            break;
        }
    }
    if (!node) return;
    node.width = 510;
    const word_count = content.split(/\s+/).length;
    const number_of_lines = Math.ceil(word_count / 7);
    if (word_count > 500) {
        node.width = 750;
        node.height = Math.max(200, number_of_lines * 35);
    } else {
        node.height = Math.max(200, number_of_lines * 45);
    }

    node.setText(content);
    node.render();
}

export async function addNodeToCanvas(
    plugin: CaretPlugin,
    canvas: Canvas,
    id: string,
    { x, y, width, height, type, content }: NewNode
) {
    if (!canvas) {
        return;
    }

    const data = canvas.getData();
    if (!data) {
        return;
    }

    const node: Partial<CanvasTextData | CanvasFileData> = {
        id: id,
        x: x,
        y: y,
        width: width,
        height: height,
        type: type,
    };

    switch (type) {
        case "text":
            node.text = content;
            break;
        case "file":
            node.file = content;
            break;
    }

    canvas.importData({
        nodes: [...data.nodes, node],
        edges: data.edges,
    });

    canvas.requestFrame();

    return node;
}
