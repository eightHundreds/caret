import { Modal, Notice } from "obsidian";
import { ai_sdk_streaming, get_provider, isEligibleProvider, ai_sdk_completion, sdk_provider } from "../services/llm_calls";
import type CaretPlugin from "../main";
import type { Message } from "../types";

export function registerCanvasPromptCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "canvas-prompt",
        name: "Canvas prompt",
        checkCallback: (checking: boolean) => {
            const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
            let on_canvas = false;
            // @ts-ignore
            if (canvas_view?.canvas) {
                on_canvas = true;
            }
            // @ts-ignore TODO: Type this better
            if (on_canvas) {
                if (!checking) {
                    (async () => {
                        // @ts-ignore
                        const canvas = canvas_view.canvas;
                        const selection = canvas.selection;

                        let average_x = 0;
                        let average_y = 0;
                        let average_height = 0;
                        let average_width = 0;

                        let total_x = 0;
                        let total_y = 0;
                        let count = 0;
                        let total_height = 0;
                        let total_width = 0;
                        let all_text = "";

                        let convo_total_tokens = 0;

                        const context_window = plugin.settings.context_window;

                        for (const obj of selection) {
                            const { x, y, height, width } = obj;
                            total_x += x;
                            total_y += y;
                            total_height += height;
                            total_width += width;
                            count++;
                            if ("text" in obj) {
                                const { text } = obj;
                                const text_token_length = plugin.encoder.encode(text).length;
                                if (convo_total_tokens + text_token_length < context_window) {
                                    all_text += text + "\n";
                                    convo_total_tokens += text_token_length;
                                } else {
                                    new Notice("Context window exceeded");
                                    break;
                                }
                            } else if ("filePath" in obj) {
                                let { filePath } = obj;
                                const file = await plugin.app.vault.getFileByPath(filePath);
                                if (!file) {
                                    console.error("Not a file at this file path");
                                    continue;
                                }
                                if (file.extension === "pdf") {
                                    const text = await plugin.extractTextFromPDF(file.name);
                                    const text_token_length = plugin.encoder.encode(text).length;
                                    if (convo_total_tokens + text_token_length > context_window) {
                                        new Notice("Context window exceeded");
                                        break;
                                    }
                                    const file_text = `PDF Title: ${file.name}`;
                                    all_text += `${file_text} \n ${text}`;
                                    convo_total_tokens += text_token_length;
                                } else if (file?.extension === "md") {
                                    const text = await plugin.app.vault.read(file);
                                    const text_token_length = plugin.encoder.encode(text).length;
                                    if (convo_total_tokens + text_token_length > context_window) {
                                        new Notice("Context window exceeded");
                                        break;
                                    }
                                    const file_text = `
                                Title: ${filePath.replace(".md", "")}
                                ${text}
                                `.trim();
                                    all_text += file_text;
                                    convo_total_tokens += text_token_length;
                                }
                            }
                        }

                        average_x = count > 0 ? total_x / count : 0;
                        average_y = count > 0 ? total_y / count : 0;
                        average_height = count > 0 ? Math.max(200, total_height / count) : 200;
                        average_width = count > 0 ? Math.max(200, total_width / count) : 200;

                        const modal = new Modal(plugin.app);
                        modal.contentEl.createEl("h1", { text: "Canvas prompt" });
                        const container = modal.contentEl.createDiv({ cls: "caret-flex-col" });
                        const text_area = container.createEl("textarea", {
                            placeholder: "",
                            cls: "caret-w-full caret-mb-2",
                        });
                        const submit_button = container.createEl("button", { text: "Submit" });
                        submit_button.onclick = async () => {
                            modal.close();
                            const prompt = `
                        Please do the following:
                        ${text_area.value}

                        Given this content:
                        ${all_text}
                        `;
                            const conversation: Message[] = [{ role: "user", content: prompt }];
                            const text_node_config = {
                                pos: { x: average_x + 50, y: average_y },
                                size: { width: average_width, height: average_height },
                                position: "center",
                                text: "",
                                save: true,
                                focus: true,
                            };
                            const node = canvas.createTextNode(text_node_config);
                            const node_id = node.id;

                            const provider = plugin.settings.llm_provider;
                            const model = plugin.settings.model;
                            const temperature = plugin.settings.temperature;

                            if (!isEligibleProvider(provider)) {
                                throw new Error(`Invalid provider: ${provider}`);
                            }

                            let sdk_provider: sdk_provider = get_provider(plugin, provider);

                            if (plugin.settings.llm_provider_options[plugin.settings.llm_provider][plugin.settings.model].streaming) {
                                const stream = await ai_sdk_streaming(sdk_provider, model, conversation, temperature, provider);

                                await plugin.update_node_content_streaming(node_id, stream);
                            } else {
                                const content = await ai_sdk_completion(sdk_provider, model, conversation, temperature, provider);
                                node.setText(content);
                            }
                        };

                        modal.open();
                    })();
                }

                return true;
            }
            return false;
        },
    });
}
