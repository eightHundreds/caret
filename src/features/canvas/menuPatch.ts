import { around } from "monkey-around";
import { Notice, setIcon, setTooltip } from "obsidian";
import { ai_sdk_image_gen } from "../../services/llm_calls";
import type CaretPlugin from "../../main";
import type { Canvas, CanvasNodeData, Edge, Node, ViewportNode } from "../../types";

function createDirectionalNode(plugin: CaretPlugin, canvas: any, direction: string) {
    const selection = canvas.selection;
    const selectionIterator = selection.values();
    const node = selectionIterator.next().value;
    if (!node) {
        return;
    }
    if (node.isEditing) {
        return;
    }
    const parent_node_x = node.x;
    const parent_node_y = node.y;
    const parent_width = node.width;
    const parent_height = node.height;

    let x: number;
    let y: number;
    let from_side: string;
    let to_side: string;

    switch (direction) {
        case "left":
            x = parent_node_x - parent_width - 200;
            y = parent_node_y;
            from_side = "left";
            to_side = "right";
            break;
        case "right":
            x = parent_node_x + parent_width + 200;
            y = parent_node_y;
            from_side = "right";
            to_side = "left";
            break;
        case "top":
            x = parent_node_x;
            y = parent_node_y - parent_height - 200;
            from_side = "top";
            to_side = "bottom";
            break;
        case "bottom":
            x = parent_node_x;
            y = parent_node_y + parent_height + 200;
            from_side = "bottom";
            to_side = "top";
            break;
        default:
            console.error("Invalid direction provided");
            return;
    }

    plugin.createChildNode(canvas, node, x, y, "", from_side, to_side);
}

function startEditingNode(canvas: Canvas) {
    const selection = canvas.selection;
    const selectionIterator = selection.values();
    const node = selectionIterator.next().value;
    node.id;
    node.isEditing = true;
    const editButton = document.querySelector('.canvas-menu button[aria-label="Edit"]') as HTMLElement;
    if (editButton) {
        editButton.click(); // Simulate the click on the edit button
    } else {
        console.error("Edit button not found");
    }
}

function runGraphChat(canvas: Canvas) {
    canvas.requestSave();
    const selection = canvas.selection;
    const selectionIterator = selection.values();
    const node = selectionIterator.next().value;
    node.id;

    const editButton = document.querySelector('.canvas-menu button[aria-label="Sparkle"]') as HTMLButtonElement;
    if (editButton) {
        setTimeout(() => {
            editButton.click(); // Simulate the click on the edit button after 200 milliseconds
        }, 200);
    } else {
        console.error("Edit button not found");
    }
}

function navigate(plugin: CaretPlugin, canvas: Canvas, direction: string) {
    const selection = canvas.selection;
    const selectionIterator = selection.values();
    const node = selectionIterator.next().value;
    if (!node) {
        return;
    }
    if (node.isEditing) {
        return;
    }
    const node_id = node.id;
    const canvas_data = canvas.getData();

    const edges: Edge[] = canvas_data.edges;
    const nodes: Node[] = canvas_data.nodes;
    let targetNodeID: string | null = null;

    switch (direction) {
        case "right":
            const edgeRightFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "right");
            if (edgeRightFrom) {
                targetNodeID = edgeRightFrom.toNode;
            } else {
                const edgeRightTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "right");
                if (edgeRightTo) {
                    targetNodeID = edgeRightTo.fromNode;
                }
            }
            break;
        case "left":
            const edgeLeftFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "left");
            if (edgeLeftFrom) {
                targetNodeID = edgeLeftFrom.toNode;
            } else {
                const edgeLeftTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "left");
                if (edgeLeftTo) {
                    targetNodeID = edgeLeftTo.fromNode;
                }
            }
            break;
        case "top":
            const edgeTopFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "top");
            if (edgeTopFrom) {
                targetNodeID = edgeTopFrom.toNode;
            } else {
                const edgeTopTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "top");
                if (edgeTopTo) {
                    targetNodeID = edgeTopTo.fromNode;
                }
            }
            break;
        case "bottom":
            const edgeBottomFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "bottom");
            if (edgeBottomFrom) {
                targetNodeID = edgeBottomFrom.toNode;
            } else {
                const edgeBottomTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "bottom");
                if (edgeBottomTo) {
                    targetNodeID = edgeBottomTo.fromNode;
                }
            }
            break;
    }

    let viewport_nodes: ViewportNode[] = [];
    let initial_viewport_children = canvas.nodeIndex.data.children;
    if (initial_viewport_children.length > 1) {
        let type_nodes = "nodes";

        if (initial_viewport_children[0] && "children" in initial_viewport_children[0]) {
            type_nodes = "children";
        }
        if (type_nodes === "children") {
            for (let i = 0; i < initial_viewport_children.length; i++) {
                const nodes_list = initial_viewport_children[i].children;

                nodes_list.forEach((node: ViewportNode) => {
                    viewport_nodes.push(node);
                });
            }
        }
        if (type_nodes === "nodes") {
            for (let i = 0; i < initial_viewport_children.length; i++) {
                const viewport_node = initial_viewport_children[i];
                viewport_nodes.push(viewport_node);
            }
        }
    }

    if (targetNodeID) {
        const target_node = viewport_nodes.find((node) => node.id === targetNodeID);
        if (target_node) {
            // @ts-ignore
            canvas.selectOnly(target_node);
            // @ts-ignore
            canvas.zoomToSelection(target_node);
        }
    }
    plugin.highlightLineage();
}

function addNewNodeButton(plugin: CaretPlugin, menuEl: HTMLElement) {
    if (!menuEl.querySelector(".graph-menu-item")) {
        const graphButtonEl = createEl("button", "clickable-icon graph-menu-item");
        setTooltip(graphButtonEl, "Create user message", { placement: "top" });
        setIcon(graphButtonEl, "lucide-workflow");
        graphButtonEl.addEventListener("click", async () => {
            const canvasView = plugin.app.workspace.getLeavesOfType("canvas").first()?.view;
            const view = plugin.app.workspace.getMostRecentLeaf()?.view;
            // @ts-ignore
            if (!view?.canvas) {
                return;
            }
            // @ts-ignore
            const canvas = view.canvas;
            const selection = canvas.selection;
            const selectionIterator = selection.values();
            const node = selectionIterator.next().value;
            const x = node.x + node.width + 200;
            const new_node = await plugin.createChildNode(canvas, node, x, node.y, "");
            new_node.unknownData.role = "user";
        });
        menuEl.appendChild(graphButtonEl);
    }
}

function addSparkleButton(plugin: CaretPlugin, menuEl: HTMLElement) {
    if (!menuEl.querySelector(".spark_button")) {
        const buttonEl = createEl("button", "clickable-icon spark_button");
        setTooltip(buttonEl, "Sparkle", { placement: "top" });
        setIcon(buttonEl, "lucide-sparkles");
        buttonEl.addEventListener("click", async () => {
            const canvasView = plugin.app.workspace.getMostRecentLeaf()?.view;
            // @ts-ignore
            if (!canvasView.canvas) {
                return;
            }
            // @ts-ignore
            const canvas = canvasView.canvas;
            await canvas.requestSave(true);
            const selection = canvas.selection;
            const selectionIterator = selection.values();
            const node = selectionIterator.next().value;
            const node_id = node.id;
            await plugin.sparkle(node_id);
        });
        menuEl.appendChild(buttonEl);
    }
}

function addExtraActions(plugin: CaretPlugin, menuEl: HTMLElement) {
    if (!menuEl.querySelector(".wand")) {
        const graphButtonEl = createEl("button", "clickable-icon wand");
        setIcon(graphButtonEl, "lucide-wand");

        interface SubmenuItemConfig {
            name: string;
            icon: string;
            tooltip: string;
            callback: () => void | Promise<void>;
        }

        function createSubmenu(configs: SubmenuItemConfig[]): HTMLElement {
            const submenuEl = createEl("div", { cls: "caret-submenu" });

            configs.forEach((config) => {
                const submenuItem = createEl("div", { cls: "caret-submenu-item" });
                const iconEl = createEl("span", { cls: "caret-clickable-icon" });
                setIcon(iconEl, config.icon);
                setTooltip(iconEl, config.tooltip, { placement: "top" });
                submenuItem.appendChild(iconEl);
                submenuItem.addEventListener("click", config.callback);
                submenuEl.appendChild(submenuItem);
            });

            return submenuEl;
        }
        const canvasView = plugin.app.workspace.getLeavesOfType("canvas").first()?.view;
        const view = plugin.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!view?.canvas) {
            return;
        }
        // @ts-ignore
        const canvas = view.canvas;
        const selection = canvas.selection;
        const selectionIterator = selection.values();
        const node = selectionIterator.next().value;

        let submenuVisible = false;

        graphButtonEl.addEventListener("click", () => {
            const submenuConfigs: SubmenuItemConfig[] = [
                {
                    name: "User",
                    icon: "lucide-user",
                    tooltip: "Set role to user",
                    callback: () => {
                        node.unknownData.role = "user";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                    name: "Assistant",
                    icon: "lucide-bot",
                    tooltip: "Set role to assistant",
                    callback: () => {
                        node.unknownData.role = "assistant";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                    name: "System Prompt",
                    icon: "lucide-monitor-check",
                    tooltip: "Set system prompt",
                    callback: () => {
                        node.unknownData.role = "system";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                    name: "Log",
                    icon: "lucide-file-text",
                    tooltip: "Log data about current node.",
                    callback: () => {
                        let output = "=== NODE INSPECTION ===\n\n";

                        output += `Constructor name: ${node.constructor.name}\n`;
                        output += `Node ID: ${node.id}\n`;
                        output += `Node type: ${node.type}\n\n`;

                        const ownProps = Object.getOwnPropertyNames(node);
                        output += `Own properties (${ownProps.length}):\n`;
                        ownProps.forEach((prop) => {
                            const value = (node as any)[prop];
                            const type = typeof value;
                            output += `  ${prop}: ${type}`;
                            if (type === "string" || type === "number" || type === "boolean") {
                                output += ` = ${JSON.stringify(value)}`;
                            } else if (type === "object" && value !== null) {
                                output += ` = ${Object.prototype.toString.call(value)}`;
                            }
                            output += `\n`;
                        });
                        output += `\n`;

                        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(node))
                            .filter((name) => typeof (node as any)[name] === "function")
                            .filter((name) => name !== "constructor");
                        output += `Available methods (${methods.length}):\n`;
                        methods.forEach((method) => {
                            output += `  ${method}()\n`;
                        });
                        output += `\n`;

                        const keyProps = ["text", "type", "id", "x", "y", "width", "height", "unknownData"];
                        output += `Key property descriptors:\n`;
                        keyProps.forEach((prop) => {
                            if (prop in node) {
                                const descriptor = Object.getOwnPropertyDescriptor(node, prop);
                                output += `  ${prop}: writable=${descriptor?.writable}, enumerable=${descriptor?.enumerable}, configurable=${descriptor?.configurable}\n`;
                            }
                        });
                        output += `\n`;

                        output += `Prototype chain:\n`;
                        let proto = Object.getPrototypeOf(node);
                        let level = 0;
                        while (proto && level < 5) {
                            output += `  Level ${level}: ${proto.constructor.name}\n`;
                            proto = Object.getPrototypeOf(proto);
                            level++;
                        }
                        output += `\n`;

                        if (node.unknownData) {
                            output += `unknownData contents:\n`;
                            Object.keys(node.unknownData).forEach((key) => {
                                const value = node.unknownData[key];
                                output += `  ${key}: ${typeof value} = ${JSON.stringify(value)}\n`;
                            });
                            output += `\n`;
                        }

                        output += "=== END NODE INSPECTION ===";
                    },
                },
                {
                    name: "Log Canvas",
                    icon: "lucide-layout-grid",
                    tooltip: "Log comprehensive canvas data",
                    callback: async () => {
                        let output = "=== CANVAS INSPECTION ===\n\n";

                        const canvas_data = canvas.getData();
                        const all_nodes = await plugin.getAllNodesFullData(canvas);

                        output += `Canvas basic info:\n`;
                        output += `  Total nodes: ${canvas_data.nodes.length}\n`;
                        output += `  Total edges: ${canvas_data.edges.length}\n`;
                        output += `  Canvas object type: ${canvas.constructor.name}\n\n`;

                        output += `Canvas properties:\n`;
                        const canvasProps = Object.getOwnPropertyNames(canvas);
                        canvasProps.forEach((prop) => {
                            const value = (canvas as any)[prop];
                            const type = typeof value;
                            output += `  ${prop}: ${type}`;
                            if (type === "string" || type === "number" || type === "boolean") {
                                output += ` = ${JSON.stringify(value)}`;
                            } else if (type === "object" && value !== null) {
                                output += ` = ${Object.prototype.toString.call(value)}`;
                            }
                            output += `\n`;
                        });
                        output += `\n`;

                        const canvasMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(canvas))
                            .filter((name) => typeof (canvas as any)[name] === "function")
                            .filter((name) => name !== "constructor");
                        output += `Canvas methods (${canvasMethods.length}):\n`;
                        canvasMethods.forEach((method) => {
                            output += `  ${method}()\n`;
                        });
                        output += `\n`;

                        output += `Nodes summary:\n`;
                        const nodesByType: Record<string, number> = {};
                        const nodesByRole: Record<string, number> = {};

                        all_nodes.forEach((node) => {
                            const type = (node as any).type || "unknown";
                            nodesByType[type] = (nodesByType[type] || 0) + 1;

                            const role = (node as any).unknownData?.role || "none";
                            nodesByRole[role] = (nodesByRole[role] || 0) + 1;
                        });

                        output += `  By type:\n`;
                        Object.entries(nodesByType).forEach(([type, count]) => {
                            output += `    ${type}: ${count}\n`;
                        });

                        output += `  By role:\n`;
                        Object.entries(nodesByRole).forEach(([role, count]) => {
                            output += `    ${role}: ${count}\n`;
                        });
                        output += `\n`;

                        output += `Edges summary:\n`;
                        const edgesBySide: Record<string, number> = {};
                        canvas_data.edges.forEach((edge: any) => {
                            const connection = `${edge.fromSide}->${edge.toSide}`;
                            edgesBySide[connection] = (edgesBySide[connection] || 0) + 1;
                        });

                        output += `  By connection type:\n`;
                        Object.entries(edgesBySide).forEach(([connection, count]) => {
                            output += `    ${connection}: ${count}\n`;
                        });
                        output += `\n`;

                        output += `Individual nodes (first 10):\n`;
                        all_nodes.slice(0, 10).forEach((node, index) => {
                            output += `  Node ${index + 1}:\n`;
                            output += `    ID: ${(node as any).id}\n`;
                            output += `    Type: ${(node as any).type}\n`;
                            output += `    Position: (${(node as any).x}, ${(node as any).y})\n`;
                            output += `    Size: ${(node as any).width}x${(node as any).height}\n`;
                            output += `    Role: ${(node as any).unknownData?.role || "none"}\n`;
                            if ((node as any).text) {
                                const preview =
                                    (node as any).text.substring(0, 50) +
                                    ((node as any).text.length > 50 ? "..." : "");
                                output += `    Text preview: "${preview}"\n`;
                            }
                            output += `\n`;
                        });

                        if (all_nodes.length > 10) {
                            output += `  ... and ${all_nodes.length - 10} more nodes\n\n`;
                        }

                        if (canvas.selection && canvas.selection.size > 0) {
                            output += `Current selection:\n`;
                            output += `  Selected items: ${canvas.selection.size}\n`;
                            const selection_iterator = canvas.selection.values();
                            for (const selected of selection_iterator) {
                                output += `    - ${selected.constructor.name} (ID: ${selected.id})\n`;
                            }
                            output += `\n`;
                        }

                        output += `File node creation analysis:\n`;

                        if (typeof canvas.createFileNode === "function") {
                            output += `  createFileNode method: EXISTS\n`;
                            output += `  createFileNode toString: ${canvas.createFileNode
                                .toString()
                                .substring(0, 200)}...\n`;
                        } else {
                            output += `  createFileNode method: NOT FOUND\n`;
                        }

                        const fileNodes = all_nodes.filter(
                            (node) => (node as any).type === "file" || (node as any).file || (node as any).filePath
                        );
                        output += `  Existing file nodes: ${fileNodes.length}\n`;
                        fileNodes.forEach((node, index) => {
                            output += `    File node ${index + 1}:\n`;
                            output += `      ID: ${(node as any).id}\n`;
                            output += `      Type: ${(node as any).type}\n`;
                            output += `      File: ${(node as any).file || "none"}\n`;
                            output += `      FilePath: ${(node as any).filePath || "none"}\n`;
                            output += `      Constructor: ${(node as any).constructor.name}\n`;

                            output += `      All properties:\n`;
                            Object.getOwnPropertyNames(node).forEach((prop) => {
                                const value = (node as any)[prop];
                                const type = typeof value;
                                output += `        ${prop}: ${type}`;
                                if (type === "string" || type === "number" || type === "boolean") {
                                    output += ` = ${JSON.stringify(value)}`;
                                } else if (type === "object" && value !== null) {
                                    if (prop === "file" && (value as any).getShortName) {
                                        output += ` = File object with getShortName()`;
                                    } else {
                                        output += ` = ${Object.prototype.toString.call(value)}`;
                                    }
                                }
                                output += `\n`;
                            });

                            if ((node as any).file) {
                                output += `      File object analysis:\n`;
                                output += `        File type: ${typeof (node as any).file}\n`;
                                output += `        File constructor: ${(node as any).file.constructor?.name || "unknown"}\n`;
                                output += `        Has getShortName: ${typeof (node as any).file?.getShortName === "function"}\n`;
                                if (typeof (node as any).file?.getShortName === "function") {
                                    try {
                                        output += `        getShortName(): ${(node as any).file.getShortName()}\n`;
                                    } catch (e) {
                                        output += `        getShortName() error: ${e}\n`;
                                    }
                                }
                                output += `        File methods: ${Object.getOwnPropertyNames(
                                    Object.getPrototypeOf((node as any).file)
                                ).filter((name) => typeof (node as any).file[name] === "function")}\n`;
                            }

                            if ((node as any).unknownData) {
                                output += `      UnknownData full structure:\n`;
                                Object.keys((node as any).unknownData).forEach((key) => {
                                    const value = (node as any).unknownData[key];
                                    output += `        ${key}: ${typeof value} = ${JSON.stringify(value)}\n`;
                                });
                            }
                            output += `\n`;
                        });

                        output += `Experimental file node creation attempt:\n`;
                        try {
                            const imagePath = "Screenshot 2024-09-06 at 11.41.57 AM.png";
                            output += `  Target image path: ${imagePath}\n`;

                            if (typeof canvas.createFileNode === "function") {
                                output += `  Attempting createFileNode...\n`;

                                const testConfigs = [
                                    { pos: { x: 100, y: 100 }, size: { width: 400, height: 300 }, file: imagePath },
                                    { x: 100, y: 100, width: 400, height: 300, file: imagePath },
                                    { file: imagePath, x: 100, y: 100 },
                                ];

                                testConfigs.forEach((config, index) => {
                                    try {
                                        output += `    Test config ${index + 1}: ${JSON.stringify(config)}\n`;
                                        output += `    Config type: ${typeof config}\n`;
                                    } catch (error) {
                                        output += `    Test config ${index + 1} failed: ${error}\n`;
                                    }
                                });
                            } else {
                                output += `  createFileNode not available\n`;
                            }

                            output += `  Canvas data structure:\n`;
                            if (canvas_data.nodes.length > 0) {
                                const sampleNode = canvas_data.nodes[0];
                                output += `    Sample node structure: ${JSON.stringify(sampleNode, null, 2).substring(0, 300)}...\n`;
                            }
                        } catch (error) {
                            output += `  Experimental creation failed: ${error}\n`;
                        }

                        output += "=== END CANVAS INSPECTION ===";
                    },
                },
                {
                    name: "Generate Image",
                    icon: "lucide-image",
                    tooltip: "Generate image from prompt and create file node",
                    callback: async () => {
                        try {
                            const prompt = node.text || node.unknownData.text || "";
                            if (!prompt.trim()) {
                                new Notice("No prompt found in node text!");
                                return;
                            }

                            new Notice("Generating image...");

                            const imageProvider = plugin.getImageProvider();
                            if (!imageProvider) {
                                new Notice(`Image provider ${plugin.settings.image_provider} not configured!`);
                                return;
                            }
                            new Notice(`Using model: ${plugin.settings.image_model}`);

                            const base64 = await ai_sdk_image_gen({
                                prompt,
                                provider: imageProvider,
                                model: plugin.settings.image_model,
                            });

                            const words = prompt.trim().split(/\s+/).slice(0, 4);
                            const baseName = words
                                .join("_")
                                .toLowerCase()
                                .replace(/[^a-zA-Z0-9_]/g, "");
                            const ext = ".png";

                            const imageFolder = "caret-images";
                            const folder = plugin.app.vault.getAbstractFileByPath(imageFolder);
                            if (!folder) {
                                await plugin.app.vault.createFolder(imageFolder);
                            }

                            let fileName = `${baseName}${ext}`;
                            let filePath = `${imageFolder}/${fileName}`;
                            let counter = 1;
                            let fileExistsCheck = plugin.app.vault.getFileByPath(filePath);
                            while (fileExistsCheck) {
                                fileName = `${baseName}_${counter}${ext}`;
                                filePath = `${imageFolder}/${fileName}`;
                                fileExistsCheck = plugin.app.vault.getFileByPath(filePath);
                                counter++;
                            }

                            await plugin.app.vault.createBinary(filePath, base64 as unknown as ArrayBuffer);
                            const fileObj = plugin.app.vault.getFileByPath(filePath);

                            if (!fileObj) {
                                new Notice("Failed to save image file!");
                                return;
                            }

                            new Notice("Image generated! Creating file node...");

                            let success = false;

                            if (!success && typeof canvas.createFileNode === "function") {
                                const fileNodeConfig = {
                                    pos: { x: node.x + node.width + 50, y: node.y },
                                    size: { width: 400, height: 300 },
                                    file: fileObj,
                                };
                                try {
                                    canvas.createFileNode(fileNodeConfig);
                                    success = true;
                                } catch (e) {
                                    console.error("createFileNode failed:", e);
                                }
                            }

                            if (!success) {
                                try {
                                    const fileNodeData = await plugin.addNodeToCanvas(canvas, plugin.generateRandomId(16), {
                                        x: node.x + node.width + 50,
                                        y: node.y,
                                        width: 400,
                                        height: 300,
                                        type: "file",
                                        content: fileObj.path,
                                    });

                                    if (fileNodeData) {
                                        if (typeof canvas.createFileNode === "function") {
                                            const newFileNode = canvas.createFileNode(fileNodeData);
                                            if (newFileNode) {
                                                success = true;
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error("Fallback file node creation failed:", e);
                                }
                            }

                            if (!success) {
                                try {
                                    const fileNodeConfig = {
                                        pos: { x: node.x + node.width + 50, y: node.y },
                                        size: { width: 400, height: 300 },
                                        filePath: fileObj.path,
                                    };
                                    const newFileNode = canvas.createFileNode(fileNodeConfig);
                                    if (newFileNode) {
                                        success = true;
                                    }
                                } catch (e) {
                                    console.error("Secondary fallback file node creation failed:", e);
                                }
                            }

                            if (success) {
                                new Notice("Image generated and file node created!");
                            } else {
                                new Notice("Image generated but failed to create file node!");
                            }
                        } catch (error: any) {
                            console.error("Image generation failed:", error);
                            new Notice(`Image generation failed: ${error.message}`);
                        }
                    },
                },
            ];

            let submenuEl = graphButtonEl.querySelector(".caret-submenu");

            if (submenuVisible) {
                if (submenuEl) {
                    submenuEl.remove();
                }
                submenuVisible = false;
            } else {
                submenuEl = createSubmenu(submenuConfigs);
                graphButtonEl.appendChild(submenuEl);
                submenuVisible = true;
            }
        });

        menuEl.appendChild(graphButtonEl);
    }
}

export function patchCanvasMenu(plugin: CaretPlugin) {
    const canvasView = plugin.app.workspace.getMostRecentLeaf()?.view;
    // @ts-ignore
    if (!canvasView?.canvas) {
        return;
    }
    if (!canvasView) {
        return;
    }
    // @ts-ignore
    const canvas = canvasView.canvas;
    const nodes = canvas.nodes;

    for (const node of nodes.values()) {
        if (node.unknownData) {
            if (!node.unknownData.role) {
                node.unknownData.role = "";
            }
            if (node.unknownData.displayOverride) {
                node.unknownData.displayOverride = false;
            }
        }
    }

    const menu = canvas.menu;
    if (!menu) {
        console.error("No menu found on the canvas");
        return;
    }

    const menuUninstaller = around(menu.constructor.prototype, {
        render: (next: any) =>
            async function (...args: any) {
                const result = await next.call(this, ...args);

                addNewNodeButton(plugin, this.menuEl);

                addSparkleButton(plugin, this.menuEl);
                addExtraActions(plugin, this.menuEl);

                return result;
            },
    });
    plugin.register(menuUninstaller);

    const functions = {
        onDoubleClick: (next: any) =>
            function (event: MouseEvent) {
                next.call(this, event);
            },
        onPointerdown: (next: any) =>
            function (event: MouseEvent) {
                if (event.target) {
                    // @ts-ignore
                    const isNode = event.target.closest(".canvas-node");
                    const canvas_color_picker_item = document.querySelector('.clickable-icon button[aria-label="Set Color"]');

                    if (isNode) {
                        plugin.highlightLineage();
                    } else {
                        plugin.unhighlightLineage();
                    }
                } else {
                    plugin.unhighlightLineage();
                }

                next.call(this, event);
            },

        requestFrame: (next: any) =>
            function (...args: any) {
                const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
                // @ts-ignore
                if (!canvas_view?.canvas) {
                    return;
                }
                // @ts-ignore TODO: Type this better
                const canvas = canvas_view.canvas;
                const nodes = canvas.nodes;

                for (const node of nodes.values()) {
                    if (node.unknownData) {
                        if (!node.unknownData.role) {
                            node.unknownData.role = "";
                        }
                        if (!node.unknownData.displayOverride) {
                            node.unknownData.displayOverride = false;
                        }
                    }
                    const contentEl = node.contentEl;
                    if (contentEl) {
                        const targetDiv = contentEl.querySelector(".markdown-embed-content.node-insert-event");
                        if (targetDiv) {
                            let customDisplayDiv = contentEl.querySelector("#caret-custom-display");
                            if (node.unknownData.role.length > 0) {
                                if (!customDisplayDiv) {
                                    customDisplayDiv = document.createElement("div");
                                    customDisplayDiv.id = "caret-custom-display";
                                    targetDiv.parentNode.insertBefore(customDisplayDiv, targetDiv);
                                }

                                if (node.unknownData.role === "assistant") {
                                    customDisplayDiv.textContent = "🤖";
                                } else if (node.unknownData.role === "user") {
                                    customDisplayDiv.textContent = "👤";
                                } else if (node.unknownData.role === "system") {
                                    customDisplayDiv.textContent = "🖥️";
                                } else if (node.unknownData.role === "cleared") {
                                    node.unknownData.role = "";

                                    customDisplayDiv.textContent = "";
                                    customDisplayDiv.remove();
                                }
                            }

                            node.unknownData.displayOverride = true;
                        }
                    }
                }

                const result = next.call(this, ...args);
                return result;
            },
    };
    const doubleClickPatcher = around(canvas.constructor.prototype, functions);
    plugin.register(doubleClickPatcher);

    canvasView.scope?.register(["Mod", "Shift"], "ArrowUp", () => {
        createDirectionalNode(plugin, canvas, "top");
    });

    canvasView.scope?.register(["Mod"], "ArrowUp", () => {
        navigate(plugin, canvas, "top");
    });
    canvasView.scope?.register(["Mod"], "ArrowDown", () => {
        navigate(plugin, canvas, "bottom");
    });
    canvasView.scope?.register(["Mod"], "ArrowLeft", () => {
        navigate(plugin, canvas, "left");
    });
    canvasView.scope?.register(["Mod"], "ArrowRight", () => {
        navigate(plugin, canvas, "right");
    });
    canvasView.scope?.register(["Mod"], "Enter", () => {
        startEditingNode(canvas);
    });

    canvasView.scope?.register(["Mod", "Shift"], "ArrowUp", () => {
        createDirectionalNode(plugin, canvas, "top");
    });
    canvasView.scope?.register(["Mod", "Shift"], "ArrowDown", () => {
        createDirectionalNode(plugin, canvas, "bottom");
    });
    canvasView.scope?.register(["Mod", "Shift"], "ArrowLeft", () => {
        createDirectionalNode(plugin, canvas, "left");
    });
    canvasView.scope?.register(["Mod", "Shift"], "ArrowRight", () => {
        createDirectionalNode(plugin, canvas, "right");
    });
    canvasView.scope?.register(["Mod", "Shift"], "Enter", () => {
        runGraphChat(canvas);
    });

    if (!plugin.canvas_patched) {
        // @ts-ignore
        canvasView.leaf.rebuildView();
        plugin.canvas_patched = true;
    }
}
