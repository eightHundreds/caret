import { App, Modal, Notice, Setting } from "obsidian";
import { CaretPluginSettings, CustomModels } from "../../types";
import { ensureModelSettings } from "../../config/llm-provider-registry";
export class CustomModelModal extends Modal {
    model_id: string = "";
    model_name: string = "";
    streaming: boolean = true;
    vision: boolean = false;
    function_calling: boolean = false;
    context_window: number = 0;
    url: string = "";
    api_key: string = "";
    plugin: any;

    constructor(app: App, plugin: any) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Add custom model" });
        contentEl.createEl("div", { text: "仅支持 OpenAI 兼容接口，请填写 endpoint 与 API key。", cls: "callout" });
        contentEl.createEl("div", {
            text: "Endpoint 需要允许 CORS。如果遇到跨域问题，请调整服务端设置或反馈需求。",
            cls: "callout",
        });

        new Setting(contentEl)
            .setName("Model ID")
            .setDesc("This is the model. This is the value for the model parameter that will be sent to the endpoint.")
            .addText((text) => {
                text.setValue(this.model_id).onChange((value) => {
                    this.model_id = value;
                });
            });

        new Setting(contentEl)
            .setName("Model name")
            .setDesc("This is the human-friendly name only used for displaying.")
            .addText((text) => {
                text.setValue(this.model_name).onChange((value) => {
                    this.model_name = value;
                });
            });

        new Setting(contentEl)
            .setName("Vision")
            .setDesc("Not used currently, will be used to know if the model can process pictures.")
            .addToggle((toggle) => {
                toggle.setValue(this.vision).onChange((value) => {
                    this.vision = value;
                });
            });
        new Setting(contentEl)
            .setName("Function calling")
            .setDesc("Does the model support function calling?")
            .addToggle((toggle) => {
                toggle.setValue(this.function_calling).onChange((value) => {
                    this.function_calling = value;
                });
            });
        new Setting(contentEl)
            .setName("Streaming")
            .setDesc("是否支持流式输出。")
            .addToggle((toggle) => {
                toggle.setValue(this.streaming).onChange((value) => {
                    this.streaming = value;
                });
            });

        new Setting(contentEl)
            .setName("Context size")
            .setDesc("You can normally pull this out of the Hugging Face repo, the config.json.")
            .addText((text) => {
                text.setValue(this.context_window.toString()).onChange((value) => {
                    this.context_window = parseInt(value);
                });
            });

        new Setting(contentEl)
            .setName("Custom endpoint")
            .setDesc("This is where the model is located. It can be a remote URL or a server URL running locally.")
            .addText((text) => {
                text.setValue(this.url).onChange((value) => {
                    this.url = value;
                });
            });

        new Setting(contentEl)
            .setName("API key")
            .setDesc("This is the API key required to access the model.")
            .addText((text) => {
                text.setValue(this.api_key).onChange((value) => {
                    this.api_key = value;
                });
            });
        new Setting(contentEl).addButton((button) => {
            button.setButtonText("Submit").onClick(async () => {
                const settings: CaretPluginSettings = this.plugin.settings;
                const parsed_context_window = parseInt(this.context_window.toString());

                if (!this.model_name || this.model_name.trim() === "") {
                    new Notice("Model name must exist");
                    console.error("Validation Error: Model name must exist");
                    return;
                }

                if (!this.url || this.url.trim() === "") {
                    new Notice("Endpoint must be set");
                    console.error("Validation Error: Endpoint must be set");
                    return;
                }

                if (!this.api_key || this.api_key.trim() === "") {
                    new Notice("API key must exist");
                    console.error("Validation Error: API key must exist");
                    return;
                }

                if (!this.model_id || this.model_id.trim() === "") {
                    new Notice("Model ID must have a value");
                    console.error("Validation Error: Model ID must have a value");
                    return;
                }

                if (isNaN(parsed_context_window)) {
                    new Notice("Context window must be a number");
                    console.error("Validation Error: Context window must be a number");
                    return;
                }
                const new_model: CustomModels = {
                    name: this.model_name,
                    context_window: parsed_context_window,
                    function_calling: this.function_calling,
                    vision: this.vision,
                    streaming: this.streaming,
                    endpoint: this.url,
                    api_key: this.api_key,
                };

                settings.custom_endpoints[this.model_id] = new_model;
                ensureModelSettings(settings);

                await this.plugin.saveSettings();

                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
