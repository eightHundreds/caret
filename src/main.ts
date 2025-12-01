import { z } from "zod";

import {
    ai_sdk_streaming,
    sdk_provider,
    get_provider,
    isEligibleProvider,
    ai_sdk_completion,
    ai_sdk_structured,
    ai_sdk_image_gen,
} from "./services/llm_calls";

// // @ts-ignore
// import ollama from "ollama/browser";
import { encodingForModel } from "js-tiktoken";
import { Canvas, ViewportNode, Message, Node, Edge, SparkleConfig, UnknownData, ImageModelOptions, NewNode, CaretPluginSettings } from "./types";
import { Notice, Plugin, requestUrl, editorEditorField, addIcon, loadPdfJs } from "obsidian";
import { CanvasFileData, CanvasNodeData, CanvasTextData } from "obsidian/canvas";
import "./style/old.css";
// Import all of the views, components, models, etc
import { CaretSettingTab } from "./ui/settings";
import { redBackgroundField } from "./features/editor/inlineDiffs";
import { FullPageChat, VIEW_CHAT } from "./ui/views/chat";
import { CaretCanvas, mergeSettingsAndSparkleConfig } from "./features/canvas/caret_canvas";
import { patchCanvasMenu as setupCanvasMenu } from "./features/canvas/menuPatch";
import { getLongestLineage, highlightLineage as doHighlightLineage, unhighlightLineage as doUnhighlightLineage } from "./features/canvas/lineage";
import { registerCommands } from "./command";
import { buildConversation } from "./features/chat/conversationBuilder";
import { refreshNode as refreshNodeHelper } from "./features/chat/refreshNode";
import { updateNodeContent, updateNodeContentStreaming, addNodeToCanvas as addNodeToCanvasHelper } from "./features/chat/streaming";
import { addChatIconToRibbon, addCaretCanvasIcon } from "./ui/ribbon";
import { escapeXml as escapeXmlUtil } from "./utils/string";
import { extractTextFromPDF as extractTextFromPDFUtil, getChatLog as getChatLogUtil, getFrontmatter as getFrontmatterUtil } from "./utils/file";
const parseString = require("xml2js").parseString;
import { StreamTextResult, CoreTool } from "ai";
import { DEFAULT_SETTINGS } from "./config/default-setting";

import { buildProviderMaps, createImageProvider, createProviderClient, ImageProviderKey } from "./services/provider-factory";
import type { image_provider } from "./services/llm_calls";
import { ensureModelSettings } from "./config/llm-provider-registry";

export default class CaretPlugin extends Plugin {
    settings: CaretPluginSettings;
    canvas_patched: boolean = false;
    selected_node_colors: any = {};
    color_picker_open_on_last_click: boolean = false;
    encoder: any;
    pdfjs: any;
    custom_client: any;
    llmProviders: Record<string, sdk_provider> = {};
    imageProviders: Partial<Record<ImageProviderKey, image_provider>> = {};
    highlightLineage = () => doHighlightLineage(this);
    unhighlightLineage = () => doUnhighlightLineage(this);
    patchCanvasMenu = () => setupCanvasMenu(this);
    buildConversation = (node: Node, nodes: Node[], edges: any[], system_prompt: string, context_window: number) =>
        buildConversation(this, node, nodes, edges, system_prompt, context_window);
    refreshNode = (
        refreshed_node_id: string,
        system_prompt: string = "",
        sparkle_config: SparkleConfig = {
            model: "default",
            provider: "default",
            temperature: 1,
            context_window: "default",
        }
    ) => refreshNodeHelper(this, refreshed_node_id, system_prompt, sparkle_config);
    update_node_content_streaming = (
        node_id: string,
        stream: StreamTextResult<Record<string, CoreTool<any, any>>, never>
    ) => updateNodeContentStreaming(this, node_id, stream);
    update_node_content = (node_id: string, content: string) => updateNodeContent(this, node_id, content);
    addChatIconToRibbon = () => addChatIconToRibbon(this);
    addCaretCanvasIcon = () => addCaretCanvasIcon(this);
    escapeXml = (unsafe: string) => escapeXmlUtil(unsafe);
    getFrontmatter = (file: any) => getFrontmatterUtil(this, file);
    getChatLog = (folderPath: string, chatId: string) => getChatLogUtil(this, folderPath, chatId);
    extractTextFromPDF = (file_name: string) => extractTextFromPDFUtil(this, file_name);
    addNodeToCanvas = (canvas: Canvas, id: string, payload: NewNode) => addNodeToCanvasHelper(this, canvas, id, payload);
    highlightLineage = () => doHighlightLineage(this);
    unhighlightLineage = () => doUnhighlightLineage(this);
    patchCanvasMenu = () => setupCanvasMenu(this);

    async onload() {
        // Initalize extra icons
        addIcon("circle", `<circle cx="50" cy="50" r="50" fill="currentColor" />`);
        addIcon(
            "lucide-user-x",
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-x"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></svg>'
        );
        // Set up the encoder (gpt-4 is just used for everything as a short term solution)
        this.encoder = encodingForModel("gpt-4-0125-preview");
        this.pdfjs = await loadPdfJs();
        // Load settings
        await this.loadSettings();
        ensureModelSettings(this.settings);

        const { llmProviders, imageProviders } = buildProviderMaps(this.settings);
        this.llmProviders = llmProviders;
        this.imageProviders = imageProviders;
        this.custom_client = undefined;

        // Initialize settings dab.
        this.addSettingTab(new CaretSettingTab(this.app, this));

        registerCommands(this);

        // This registers patching the canvas
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (event) => {
                const currentFile = this.app.workspace.getActiveFile();
                if (currentFile?.extension === "canvas") {
                    this.unhighlightLineage();
                    this.patchCanvasMenu();
                }
            })
        );
        // Register the editor extension
        this.registerEditorExtension([redBackgroundField]);

        // Register the sidebar icon
        this.addChatIconToRibbon();

        // Register Views
        // Currently not using the sidebar chat.
        // this.registerView(VIEW_NAME_SIDEBAR_CHAT, (leaf) => new SidebarChat(leaf));
        this.registerView(VIEW_CHAT, (leaf) => new FullPageChat(this, leaf));
    }

    // General functions that the plugin uses

    async parseXml(xmlString: string): Promise<any> {
        try {
            const result = await new Promise((resolve, reject) => {
                parseString(xmlString, (err: any, result: any) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.dir(result);
            return result;
        } catch (err) {
            console.error(err);
        }
    }

    parseCustomXML(xmlString: string, tags: string[]) {
        // Function to extract content between tags
        function getContent(tag: string, string: string) {
            const openTag = `<${tag}>`;
            const closeTag = `</${tag}>`;
            const start = string.indexOf(openTag) + openTag.length;
            const end = string.indexOf(closeTag);
            const prompt_content = string.substring(start, end).trim();
            return prompt_content;
        }

        // Initialize the result object
        const result: any = {};

        // Extract content for each tag provided
        tags.forEach((tag: string) => {
            const content = getContent(tag, xmlString);
            result[tag] = content;
        });

        return result;
    }

    getAllAncestorNodes(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
        let ancestors: Node[] = [];
        let queue: string[] = [nodeId];
        let processedNodes: Set<string> = new Set();

        while (queue.length > 0) {
            let currentId = queue.shift();
            if (!currentId || processedNodes.has(currentId)) continue;

            processedNodes.add(currentId);
            const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === currentId);
            incomingEdges.forEach((edge) => {
                const ancestor = nodes.find((node) => node.id === edge.fromNode);
                if (ancestor && !processedNodes.has(ancestor.id)) {
                    ancestors.push(ancestor);
                    queue.push(ancestor.id);
                }
            });
        }

        return ancestors;
    }

    async getDirectAncestorsWithContext(nodes: Node[], edges: Edge[], nodeId: string): Promise<string> {
        let direct_ancentors_context = "";

        const startNode = nodes.find((node) => node.id === nodeId);
        if (!startNode) return "";

        const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === nodeId);
        for (let i = 0; i < incomingEdges.length; i++) {
            const edge = incomingEdges[i];
            const ancestor = nodes.find((node) => node.id === edge.fromNode);
            if (ancestor && ancestor.type === "text" && ancestor.text.includes("<context>")) {
                direct_ancentors_context += ancestor.text + "\n";
            } else if (ancestor && ancestor.type === "file" && ancestor.file && ancestor.file.includes(".md")) {
                const file_path = ancestor.file;
                const file = this.app.vault.getFileByPath(file_path);
                if (file) {
                    const context = await this.app.vault.cachedRead(file);
                    direct_ancentors_context += "\n" + context;
                } else {
                    console.error("File not found:", file_path);
                }
            }
        }
        return direct_ancentors_context;
    }
    async getAllAncestorsWithContext(nodes: Node[], edges: Edge[], nodeId: string): Promise<string> {
        let ancestors_context = "";
        let convo_total_tokens = 0;

        const findAncestorsWithContext = async (nodeId: string) => {
            const node = nodes.find((node) => node.id === nodeId);
            if (!node) return;

            const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === nodeId);
            for (let i = 0; i < incomingEdges.length; i++) {
                const edge = incomingEdges[i];
                const ancestor = nodes.find((node) => node.id === edge.fromNode);
                if (ancestor) {
                    let contextToAdd = "";

                    if (ancestor.type === "text") {
                        // @ts-ignore
                        const role = ancestor.role || "";
                        if (role.length === 0) {
                            let ancestor_text = ancestor.text;
                            if (this.settings.include_nested_block_refs) {
                                const block_ref_content = await this.getRefBlocksContent(ancestor_text);
                                ancestor_text += block_ref_content;
                            }
                            contextToAdd += ancestor_text;
                        }
                    } else if (ancestor.type === "file" && ancestor.file && ancestor.file.includes(".md")) {
                        const file_path = ancestor.file;
                        const file = this.app.vault.getFileByPath(file_path);
                        if (file) {
                            const context = await this.app.vault.cachedRead(file);

                            if (!context.includes("caret_prompt")) {
                                contextToAdd = `\n\n---------------------------\n\nFile Title: ${file_path}\n${context}`;
                            }
                        } else {
                            console.error("File not found:", file_path);
                        }
                    } else if (ancestor.type === "file" && ancestor.file && ancestor.file.includes(".pdf")) {
                        const file_name = ancestor.file;
                        const text = await this.extractTextFromPDF(file_name);
                        contextToAdd = `\n\n---------------------------\n\nPDF File Title: ${file_name}\n${text}`;
                    }

                    const contextTokens = this.encoder.encode(contextToAdd).length;
                    if (convo_total_tokens + contextTokens > this.settings.context_window) {
                        new Notice(
                            "Exceeding context window while adding ancestor context. Stopping further additions."
                        );
                        return;
                    }

                    ancestors_context += contextToAdd;
                    convo_total_tokens += contextTokens;

                    await findAncestorsWithContext(ancestor.id);
                }
            }
        };

        await findAncestorsWithContext(nodeId);
        return ancestors_context;
    }

    async getRefBlocksContent(node_text: any): Promise<string> {
        const bracket_regex = /\[\[(.*?)\]\]/g;
        let rep_block_content = node_text;

        let match;
        const matches = [];

        while ((match = bracket_regex.exec(node_text)) !== null) {
            matches.push(match);
        }
        for (const match of matches) {
            let file_path = match[1];
            if (!file_path.includes(".")) {
                file_path += ".md";
            }
            let file = await this.app.vault.getFileByPath(file_path);

            if (!file) {
                const files = this.app.vault.getFiles();
                let matchedFile = files.find((file) => file.name === file_path);
                if (matchedFile) {
                    file = matchedFile;
                }
            }
            if (file && file_path.includes(".md")) {
                const file_content = await this.app.vault.cachedRead(file);
                rep_block_content += `File: ${file_path}\n${file_content}`; // Update modified_content instead of message.content
            } else if (file && file_path.includes(".pdf")) {
                const pdf_content = await this.extractTextFromPDF(file_path);
                rep_block_content += `PDF File Name: ${file_path}\n ${pdf_content}`;
            } else {
                new Notice(`File not found: ${file_path}`);
            }
        }

        return rep_block_content;
    }
    async getCurrentNode(canvas: Canvas, node_id: string) {
        await canvas.requestSave(true);
        const nodes_iterator = canvas.nodes.values();
        let node = null;
        for (const node_obj of nodes_iterator) {
            if (node_obj.id === node_id) {
                node = node_obj;
                break;
            }
        }
        return node;
    }
    async getAllNodesFullData(canvas: Canvas): Promise<Node[]> {
        const nodes_iterator = canvas.nodes.values();
        let nodes: Node[] = [];
        for (const node_obj of nodes_iterator) {
            nodes.push(node_obj);
        }
        return nodes;
    }
    async getCurrentCanvasView() {
        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view || !canvas_view.canvas) {
            return;
        }
        // @ts-ignore
        const canvas = canvas_view.canvas;
        return canvas_view;
    }
    async getAssociatedNodeContent(currentNode: any, nodes: any[], edges: any[]): Promise<string> {
        const visited = new Set();
        const contentBlocks: string[] = [];

        const traverse = async (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = nodes.find((n) => n.id === nodeId);

            if (node) {
                let nodeContent = "";
                const data: UnknownData = node.unknownData;

                if (data.role === "") {
                    if (data.type === "text") {
                        nodeContent = data.text || "";
                        if (this.settings.include_nested_block_refs) {
                            const block_ref_content = await this.getRefBlocksContent(data.text);
                            nodeContent += block_ref_content;
                        }
                    } else if (data.type === "file") {
                        if (data.file && data.file.includes(".md")) {
                            const file = this.app.vault.getFileByPath(data.file);
                            if (file) {
                                const fileContent = await this.app.vault.cachedRead(file);
                                nodeContent = `\n\n---------------------------\n\nFile Title: ${data.file}\n${fileContent}`;
                            } else {
                                console.error("File not found:", data.file);
                            }
                        } else if (data.file && data.file.includes(".pdf")) {
                            const pdfContent = await this.extractTextFromPDF(data.file);
                            nodeContent = `\n\n---------------------------\n\nPDF File Title: ${data.file}\n${pdfContent}`;
                        }
                    } else if (data.type === "link") {
                        nodeContent = data.websiteContent || "";
                    }
                    contentBlocks.push(nodeContent);
                }
            }

            const connectedEdges = edges.filter((edge) => edge.fromNode === nodeId || edge.toNode === nodeId);
            for (const edge of connectedEdges) {
                const nextNodeId = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
                const next_node = nodes.find((n) => n.id === nextNodeId);
                if (next_node.role === "user" || next_node.role === "assistant") {
                    continue;
                }

                await traverse(nextNodeId);
            }
        };

        await traverse(currentNode.id);

        return contentBlocks.join("\n");
    }

    async sparkle(
        node_id: string,
        system_prompt: string = "",
        sparkle_config: SparkleConfig = {
            model: "default",
            provider: "default",
            temperature: 1,
            context_window: "default",
        },
        iterations: number = 1,
        xOffset: number = 200,
        yOffset: number = 0
    ) {
        // Always use the provided system_prompt (could be empty)
        let local_system_prompt = system_prompt;

        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view || !canvas_view.canvas) {
            return;
        }
        // @ts-ignore
        const canvas = canvas_view.canvas;

        let node = await this.getCurrentNode(canvas, node_id);

        if (!node) {
            console.error("Node not found with ID:", node_id);
            return;
        }

        node.unknownData.role = "user";

        const canvas_data = canvas.getData();

        const fullDataNodes = await this.getAllNodesFullData(canvas);

        const { edges } = canvas_data;
        const nodes = fullDataNodes;
        for (let i = 0; i < nodes.length; i++) {
            const currentNode = nodes[i];

            if (currentNode.unknownData.type === "link") {
                if (currentNode.unknownData.url && !currentNode.unknownData.websiteContent) {
                    const url = currentNode.unknownData.url;
                    const response = await requestUrl(url);

                    // Really simpler parser. Could improve this.
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.text, "text/html");
                    const content = doc.body ? doc.body.textContent : "";

                    const fullContent = url + "\n\n" + content;

                    currentNode.unknownData.websiteContent = fullContent;

                    // Update the corresponding node in fullDataNodes
                    const indexInFullDataNodes = fullDataNodes.findIndex((node) => node.id === currentNode.id);

                    if (indexInFullDataNodes !== -1) {
                        fullDataNodes[indexInFullDataNodes].unknownData.websiteContent = fullContent;
                    }
                }
            }
        }

        // Continue with operations on `target_node`
        if (node.hasOwnProperty("file")) {
            const file_path = node.file.path;
            const file = this.app.vault.getAbstractFileByPath(file_path);
            if (file) {
                // @ts-ignore
                const text = await this.app.vault.cachedRead(file);

                // Check for the presence of three dashes indicating the start of the front matter
                const front_matter = await this.getFrontmatter(file);
                if (front_matter.hasOwnProperty("caret_prompt")) {
                    let caret_prompt = front_matter.caret_prompt;

                    if (caret_prompt === "parallel" && text) {
                        const matchResult = text.match(/```xml([\s\S]*?)```/);
                        if (!matchResult) {
                            new Notice("Incorrectly formatted parallel workflow.");
                            return;
                        }
                        const xml_content = matchResult[1].trim();
                        const xml = await this.parseXml(xml_content);
                        const system_prompt_list = xml.root.system_prompt;

                        let system_prompt = "";
                        if (system_prompt_list[0]._) {
                            system_prompt = system_prompt_list[0]._.trim;
                        }

                        if (this.settings.include_nested_block_refs) {
                            const block_ref_content = await this.getRefBlocksContent(system_prompt);
                            if (block_ref_content.length > 0) {
                                system_prompt += block_ref_content;
                            }
                        }

                        const prompts = xml.root.prompt;
                        const card_height = node.height;
                        const middle_index = Math.floor(prompts.length / 2);
                        const highest_y = node.y - middle_index * (100 + card_height); // Calculate the highest y based on the middle index
                        const sparkle_promises = [];

                        for (let i = 0; i < prompts.length; i++) {
                            const prompt = prompts[i];

                            const prompt_content = prompt._.trim();
                            const prompt_delay = prompt.$?.delay || 0;
                            const prompt_model = prompt.$?.model || "default";
                            const prompt_provider = this.settings.llm_provider || "custom";
                            const prompt_temperature = parseFloat(prompt.$?.temperature) || this.settings.temperature;
                            const new_node_content = `${prompt_content}`;
                            const x = node.x + node.width + 200;
                            const y = highest_y + i * (100 + card_height); // Increment y for each prompt to distribute them vertically including card height

                            // Create a new user node
                            const user_node = await this.createChildNode(
                                canvas,
                                node,
                                x,
                                y,
                                new_node_content,
                                "right",
                                "left"
                            );
                            const providerOptions =
                                this.settings.llm_provider_options[
                                    this.settings.llm_provider as keyof typeof this.settings.llm_provider_options
                                ] || {};
                            const model_context_window =
                                providerOptions[prompt_model]?.context_window || this.settings.context_window;
                            user_node.unknownData.role = "user";
                            user_node.unknownData.displayOverride = false;

                            const sparkle_config: SparkleConfig = {
                                model: prompt_model,
                                provider: prompt_provider,
                                temperature: prompt_temperature,
                                context_window: model_context_window,
                            };

                            const sparkle_promise = (async () => {
                                if (prompt_delay > 0) {
                                    new Notice(`Waiting for ${prompt_delay} seconds...`);
                                    await new Promise((resolve) => setTimeout(resolve, prompt_delay * 1000));
                                    new Notice(`Done waiting for ${prompt_delay} seconds.`);
                                }
                                await this.sparkle(user_node.id, system_prompt, sparkle_config);
                            })();

                            sparkle_promises.push(sparkle_promise);
                        }

                        await Promise.all(sparkle_promises);
                        return;
                    } else if (caret_prompt === "linear") {
                        const matchResult = text.match(/```xml([\s\S]*?)```/);
                        if (!matchResult) {
                            new Notice("Incorrectly formatted linear workflow.");
                            return;
                        }
                        const xml_content = matchResult[1].trim();
                        const xml = await this.parseXml(xml_content);
                        const system_prompt_list = xml.root.system_prompt;
                        let system_prompt;
                        if (system_prompt_list[0]._) {
                            system_prompt = system_prompt_list[0]._.trim();
                        }
                        if (this.settings.include_nested_block_refs) {
                            const block_ref_content = await this.getRefBlocksContent(system_prompt);
                            if (block_ref_content.length > 0) {
                                system_prompt += block_ref_content;
                            }
                        }

                        const prompts = xml.root.prompt;

                        let current_node = node;
                        for (let i = 0; i < prompts.length; i++) {
                            const prompt = prompts[i];
                            const prompt_content = prompt._.trim();
                            const prompt_delay = prompt.$?.delay || 0;
                            const prompt_model = prompt.$?.model || "default";
                            const prompt_provider = this.settings.llm_provider || "custom";
                            const prompt_temperature = parseFloat(prompt.$?.temperature) || this.settings.temperature;
                            const new_node_content = `${prompt_content}`;
                            const x = current_node.x + current_node.width + 200;
                            const y = current_node.y;

                            // Create a new user node
                            const user_node = await this.createChildNode(
                                canvas,
                                current_node,
                                x,
                                y,
                                new_node_content,
                                "right",
                                "left"
                            );
                            const providerOptions =
                                this.settings.llm_provider_options[
                                    this.settings.llm_provider as keyof typeof this.settings.llm_provider_options
                                ] || {};
                            const model_context_window =
                                providerOptions[prompt_model]?.context_window || this.settings.context_window;
                            user_node.unknownData.role = "user";
                            user_node.unknownData.displayOverride = false;
                            const sparkle_config: SparkleConfig = {
                                model: prompt_model,
                                provider: prompt_provider,
                                temperature: prompt_temperature,
                                context_window: model_context_window,
                            };
                            if (prompt_delay > 0) {
                                new Notice(`Waiting for ${prompt_delay} seconds...`);
                                await new Promise((resolve) => setTimeout(resolve, prompt_delay * 1000));
                                new Notice(`Done waiting for ${prompt_delay} seconds.`);
                            }
                            const assistant_node = await this.sparkle(user_node.id, system_prompt, sparkle_config);
                            current_node = assistant_node;
                        }
                    } else {
                        new Notice("Invalid Caret prompt");
                    }

                    return;
                }
            } else {
                console.error("File not found or is not a readable file:", file_path);
            }
        }
        let context_window = sparkle_config.context_window;
        if (sparkle_config.context_window === "default") {
            context_window = this.settings.context_window;
        }
        if (typeof context_window !== "number" || isNaN(context_window)) {
            throw new Error("Invalid context window: must be a number");
        }

        const { conversation } = await this.buildConversation(node, nodes, edges, local_system_prompt, context_window);

        // Always add global system prompt as additional message if it exists
        if (this.settings.system_prompt && this.settings.system_prompt.trim().length > 0) {
            conversation.unshift({ role: "system", content: this.settings.system_prompt.trim() });
        }

        const { model, provider, temperature } = mergeSettingsAndSparkleConfig(this.settings, sparkle_config);

        const node_content = ``;
        let x = node.x + node.width + xOffset;
        let y = node.y + yOffset;
        // This is needed to work with the iterations. We still need to return the first node from the iterations
        // So linear workflows works
        let firstNode = null;

        for (let i = 0; i < iterations; i++) {
            const new_node = await this.createChildNode(canvas, node, x, y, node_content, "right", "left");
            if (!new_node) {
                throw new Error("Invalid new node");
            }
            const new_node_id = new_node.id;
            if (!new_node_id) {
                throw new Error("Invalid node id");
            }
            const new_canvas_node = await this.get_node_by_id(canvas, new_node_id);
            new_canvas_node.initialize();
            if (!new_canvas_node.unknownData.hasOwnProperty("role")) {
                new_canvas_node.unknownData.role = "";
                new_canvas_node.unknownData.displayOverride = false;
            }
            new_canvas_node.unknownData.role = "assistant";

            if (!isEligibleProvider(provider)) {
                throw new Error(`Invalid provider: ${provider}`);
            }

            let sdk_provider: sdk_provider = get_provider(this, provider);

            if (this.settings.llm_provider_options[provider][model].streaming) {
                const stream = await ai_sdk_streaming(sdk_provider, model, conversation, temperature, provider);
                new_canvas_node.text = "";
                await this.update_node_content_streaming(new_node_id, stream);
            } else {
                const content = await ai_sdk_completion(sdk_provider, model, conversation, temperature, provider);
                new_canvas_node.setText(content);
            }
            if (i === 0) {
                firstNode = new_canvas_node;
            }

            y += yOffset + node.height;
        }
        return firstNode;
    }

    async get_node_by_id(canvas: Canvas, node_id: string) {
        const nodes_iterator = canvas.nodes.values();
        for (const node of nodes_iterator) {
            if (node.id === node_id) {
                return node;
            }
        }
        return null; // Return null if no node matches the ID
    }

    async createChildNode(
        canvas: Canvas,
        parentNode: CanvasNodeData,
        x: number,
        y: number,
        content: string = "",
        from_side: string | null = "right",
        to_side: string | null = "left"
    ) {
        let tempChildNode = await this.addNodeToCanvas(canvas, this.generateRandomId(16), {
            x: x,
            y: y,
            width: 400,
            height: 200,
            type: "text",
            content,
        });
        if (from_side && to_side) {
            await this.createEdge(parentNode, tempChildNode, canvas, from_side, to_side);
        }

        const node = canvas.nodes?.get(tempChildNode?.id!);
        if (!node) {
            return;
        }
        return node;
    }

    async createEdge(node1: any, node2: any, canvas: any, from_side: string = "right", to_side: string = "left") {
        this.addEdgeToCanvas(
            canvas,
            this.generateRandomId(16),
            {
                fromOrTo: "from",
                side: from_side,
                node: node1,
            },
            {
                fromOrTo: "to",
                side: to_side,
                node: node2,
            }
        );
    }
    generateRandomId(length: number): string {
        const hexArray = Array.from({ length }, () => {
            const randomHex = Math.floor(Math.random() * 16).toString(16);
            return randomHex;
        });
        return hexArray.join("");
    }

    addEdgeToCanvas(canvas: any, edgeID: string, fromEdge: any, toEdge: any) {
        if (!canvas) {
            return;
        }

        const data = canvas.getData();
        if (!data) {
            return;
        }

        canvas.importData({
            edges: [
                ...data.edges,
                {
                    id: edgeID,
                    fromNode: fromEdge.node.id,
                    fromSide: fromEdge.side,
                    toNode: toEdge.node.id,
                    toSide: toEdge.side,
                },
            ],
            nodes: data.nodes,
        });
        canvas.requestFrame();
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getProviderClient(modelId: string): sdk_provider {
        const cached = this.llmProviders[modelId];
        if (cached) return cached;
        const created = createProviderClient(modelId, this.settings);
        if (!created) {
            throw new Error(`模型 ${modelId} 缺少有效的 endpoint 或 API key。`);
        }
        this.llmProviders[modelId] = created;
        return created;
    }

    getImageProvider() {
        const providerKey: ImageProviderKey = "openai";
        const cached = this.imageProviders[providerKey];
        if (cached) return cached;
        if (providerKey === "openai") {
            const created = createImageProvider("openai", this.settings);
            if (created) {
                this.imageProviders.openai = created as unknown as image_provider;
                return this.imageProviders.openai;
            }
        }
        return null;
    }
}
