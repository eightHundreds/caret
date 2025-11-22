import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
type ModelDropDownSettings = {
    openai: string;
    groq: string;
    ollama: string;
    anthropic?: string;
    custom?: string; // Make 'custom' optional
    perplexity: string;
};

import type CaretPlugin from "../main";
import type { CaretPluginSettings } from "../types";
import { DEFAULT_SETTINGS } from "../config/default-setting";

type ApiKeyConfig = {
    label: string;
    placeholder: string;
    keyField: keyof CaretPluginSettings;
};

const API_KEY_CONFIG: Record<string, ApiKeyConfig> = {
    openai: { label: "OpenAI", placeholder: "OpenAI API key", keyField: "openai_api_key" },
    groq: { label: "Groq", placeholder: "Groq API key", keyField: "groq_api_key" },
    anthropic: { label: "Anthropic", placeholder: "Anthropic API key", keyField: "anthropic_api_key" },
    openrouter: { label: "OpenRouter", placeholder: "OpenRouter API key", keyField: "open_router_key" },
    google: { label: "Google Gemini", placeholder: "Google Gemini API key", keyField: "google_api_key" },
    perplexity: { label: "Perplexity", placeholder: "Perplexity API key", keyField: "perplexity_api_key" },
    xai: { label: "xAI", placeholder: "xAI API key", keyField: "xai_api_key" },
};

export class CaretSettingTab extends PluginSettingTab {
    plugin: CaretPlugin;

    constructor(app: App, plugin: CaretPlugin) {
        super(app, plugin);
        this.plugin = plugin;

        // Update streaming setting for Anthropic models
        const default_llm_providers = DEFAULT_SETTINGS.llm_provider_options;
        const current_llm_providers = this.plugin.settings.llm_provider_options;

        if (current_llm_providers.anthropic) {
            for (const [modelKey, modelValue] of Object.entries(default_llm_providers.anthropic)) {
                if (current_llm_providers.anthropic[modelKey]) {
                    current_llm_providers.anthropic[modelKey].streaming = modelValue.streaming;
                }
            }
            // Save the updated settings
            this.plugin.saveSettings();
        }
    }
    private createGroup(containerEl: HTMLElement, title: string, desc?: string): HTMLElement {
        const group = containerEl.createEl("div", { cls: "caret-settings-group" });
        group.createEl("div", { cls: "caret-settings-group__title", text: title });
        if (desc) {
            group.createEl("div", { cls: "caret-settings-group__desc", text: desc });
        }
        return group;
    }

    private createCollapsible(containerEl: HTMLElement, title: string, isOpen = false): HTMLElement {
        const detailsEl = containerEl.createEl("details", { cls: "caret-settings-collapse" });
        if (isOpen) {
            (detailsEl as HTMLDetailsElement).setAttribute("open", "true");
        }
        detailsEl.createEl("summary", { text: title });
        return detailsEl;
    }

    private addApiKeySetting(
        parent: HTMLElement,
        label: string,
        placeholder: string,
        value: string,
        onChange: (val: string) => Promise<void> | void
    ) {
        new Setting(parent)
            .setName(label)
            .addText((text) => {
                text.setPlaceholder(placeholder)
                    .setValue(value)
                    .onChange(async (val: string) => {
                        await onChange(val);
                    });
                text.inputEl.addClass("caret-hidden-value-unsecure");
            });
    }
    api_settings_tab(containerEl: HTMLElement): void {
        // API settings logic here
        const default_llm_providers = DEFAULT_SETTINGS.llm_provider_options;
        const current_llm_providers = this.plugin.settings.llm_provider_options;
        const current_custom = current_llm_providers.custom;

        this.plugin.settings.llm_provider_options = { ...default_llm_providers, custom: { ...current_custom } };

        const custom_endpoints = this.plugin.settings.custom_endpoints;
        // @ts-ignore
        let model_drop_down_settings: ModelDropDownSettings = DEFAULT_SETTINGS.provider_dropdown_options;

        if (Object.keys(custom_endpoints).length > 0) {
            for (const [key, value] of Object.entries(custom_endpoints)) {
                if (value.known_provider) {
                    if (!this.plugin.settings.llm_provider_options[value.known_provider]) {
                        this.plugin.settings.llm_provider_options[value.known_provider] = {};
                    }
                    this.plugin.settings.llm_provider_options[value.known_provider][key] = value;
                } else {
                    this.plugin.settings.llm_provider_options.custom[key] = value;
                }
            }
        }

        let context_window = null;
        try {
            const llm_provider = this.plugin.settings.llm_provider;
            const model = this.plugin.settings.model;
            if (
                this.plugin.settings.llm_provider_options[llm_provider] &&
                this.plugin.settings.llm_provider_options[llm_provider][model]
            ) {
            const model_details = this.plugin.settings.llm_provider_options[llm_provider][model];
            if (model_details && model_details.context_window) {
                const context_window_value = model_details.context_window;
                context_window = parseInt(context_window_value.toString());
            }
            }
        } catch (error) {
            console.error("Error retrieving model details:", error);
            context_window = null;
        }
        if (!this.plugin.settings.llm_provider || this.plugin.settings.llm_provider.length === 0) {
            this.plugin.settings.llm_provider = "openai";
            this.plugin.settings.model = "gpt-4-turbo";
            this.plugin.settings.context_window = 128000;
            this.plugin.saveSettings();
        }

        const model_options_data = Object.fromEntries(
            Object.entries(
                this.plugin.settings.llm_provider_options[
                    this.plugin.settings.llm_provider as keyof typeof this.plugin.settings.llm_provider_options
                ]
            ).map(([key, value]) => [key, value.name])
        );

        const defaultModelGroup = this.createGroup(
            containerEl,
            "Default model",
            "Choose provider and model for text generation."
        );
        new Setting(defaultModelGroup)
            .setName("LLM provider")
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(model_drop_down_settings)
                    .setValue(this.plugin.settings.llm_provider)
                    .onChange(async (provider) => {
                        this.plugin.settings.llm_provider = provider;
                        this.plugin.settings.model = Object.keys(
                            this.plugin.settings.llm_provider_options[provider]
                        )[0];
                        this.plugin.settings.context_window =
                            this.plugin.settings.llm_provider_options[provider][
                                this.plugin.settings.model
                            ].context_window;
                        await this.plugin.saveSettings();
                        await this.plugin.loadSettings();
                        this.display();
                    });
            });

        const modelSetting = new Setting(defaultModelGroup).setName("Model").addDropdown((modelDropdown) => {
            modelDropdown.addOptions(model_options_data);
            modelDropdown.setValue(this.plugin.settings.model);
            modelDropdown.onChange(async (value) => {
                this.plugin.settings.model = value;
                this.plugin.settings.context_window =
                    this.plugin.settings.llm_provider_options[this.plugin.settings.llm_provider][value].context_window;
                await this.plugin.saveSettings();
                await this.plugin.loadSettings();
                this.display();
            });
        });

        if (context_window) {
            modelSetting.setDesc(`Context window: ${context_window}`);
        }

        if (this.plugin.settings.model === "gpt-4o") {
            defaultModelGroup.createEl("div", {
                cls: "caret-setting-note",
                text: "You are using GPT-4o. If errors occur, verify the API key has access.",
            });
        }

        const apiKeysGroup = this.createGroup(defaultModelGroup, "API keys", "Only show keys for selected providers.");
        const activeProvider = this.plugin.settings.llm_provider;
        const apiConfig = API_KEY_CONFIG[activeProvider];

        if (apiConfig) {
            const currentValue = String((this.plugin.settings as any)[apiConfig.keyField] ?? "");
            this.addApiKeySetting(
                apiKeysGroup,
                `${apiConfig.label} API key`,
                apiConfig.placeholder,
                currentValue,
                async (value: string) => {
                    (this.plugin.settings as any)[apiConfig.keyField] = value;
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                }
            );
        } else {
            apiKeysGroup.createEl("div", {
                cls: "caret-setting-note",
                text: "当前选择的提供商无需单独的 API key，或未在 API_KEY_CONFIG 中定义。",
            });
        }

        if (activeProvider === "ollama") {
            const ollamaInfo = apiKeysGroup.createEl("div", { cls: "caret-settings-local-tip" });
            ollamaInfo.createEl("strong", { text: "You're using Ollama (local)!" });
            ollamaInfo.createEl("p", { text: "Make sure you have downloaded the model you want to use:" });
            ollamaInfo.createEl("code", { text: `ollama run ${this.plugin.settings.model}` });
            ollamaInfo.createEl("p", { text: "Then start the Ollama server for Obsidian access:" });
            ollamaInfo.createEl("code", { text: "OLLAMA_ORIGINS=app://obsidian.md* ollama serve" });
        }

        apiKeysGroup.createEl("div", { cls: "caret-setting-note", text: "Reload the plugin after adding/changing keys." });

        const imageGroup = this.createGroup(
            containerEl,
            "Image generation",
            "Choose provider and model for image generation."
        );
        new Setting(imageGroup)
            .setName("Image provider")
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(this.plugin.settings.image_provider_dropdown_options)
                    .setValue(this.plugin.settings.image_provider)
                    .onChange(async (provider) => {
                        this.plugin.settings.image_provider = provider;
                        this.plugin.settings.image_model = Object.keys(
                            this.plugin.settings.image_model_options[provider]
                        )[0];
                        await this.plugin.saveSettings();
                        await this.plugin.loadSettings();
                        this.display();
                    });
            });

        const image_model_options_data = Object.fromEntries(
            Object.entries(
                this.plugin.settings.image_model_options[
                    this.plugin.settings.image_provider as keyof typeof this.plugin.settings.image_model_options
                ]
            ).map(([key, value]) => [key, value.name])
        );

        new Setting(imageGroup).setName("Image model").addDropdown((modelDropdown) => {
            modelDropdown.addOptions(image_model_options_data);
            modelDropdown.setValue(this.plugin.settings.image_model);
            modelDropdown.onChange(async (value) => {
                this.plugin.settings.image_model = value;
                await this.plugin.saveSettings();
                await this.plugin.loadSettings();
                this.display();
            });
        });

    }
    chat_settings_tab(containerEl: HTMLElement): void {
        let tempChatFolderPath = this.plugin.settings.chat_logs_folder; // Temporary storage for input value

        const debouncedSave = debounce(
            async (value: string) => {
                if (value.length <= 1) {
                    new Notice("The folder path must be longer than one character.");
                    return;
                }
                if (value.endsWith("/")) {
                    new Notice("The folder path must not end with a trailing slash.");
                    return;
                }
                if (value !== this.plugin.settings.chat_logs_folder) {
                    this.plugin.settings.chat_logs_folder = value;
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                }
            },
            1000,
            true
        ); // 500ms delay

        const logGroup = this.createGroup(containerEl, "Log storage", "Manage where chat logs live and how they are named.");
        new Setting(logGroup)
            .setName("Chat folder path")
            .setDesc("Path to store chat logs (no trailing slash).")
            .addText((text) => {
                text.setPlaceholder("Enter folder path")
                    .setValue(this.plugin.settings.chat_logs_folder)
                    .onChange((value: string) => {
                        tempChatFolderPath = value;
                        debouncedSave(value);
                    });
            });

        new Setting(logGroup)
            .setName("Use date format for subfolders")
            .setDesc("Organize chats by Year-Month-Date folders.")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.chat_logs_date_format_bool).onChange(async (value: boolean) => {
                    this.plugin.settings.chat_logs_date_format_bool = value;
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                });
            });

        new Setting(logGroup)
            .setName("Rename chats")
            .setDesc("Auto-name chats using the default provider/model.")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.chat_logs_rename_bool).onChange(async (value: boolean) => {
                    this.plugin.settings.chat_logs_rename_bool = value;
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                });
            });

        const chatGroup = this.createGroup(containerEl, "Input & context", "Control send shortcuts and nested refs.");
        const send_chat_shortcut_options: { [key: string]: string } = {
            enter: "Enter",
            shift_enter: "Shift + Enter",
            // cmd_enter: "CMD + Enter",
        };
        new Setting(chatGroup)
            .setName("Send chat keybinds")
            .setDesc("Shortcut used to send messages.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(send_chat_shortcut_options)
                    .setValue(this.plugin.settings.chat_send_chat_shortcut)
                    .onChange(async (selected) => {
                        this.plugin.settings.chat_send_chat_shortcut = selected;

                        await this.plugin.saveSettings();
                        await this.plugin.loadSettings();
                    });
            });

        new Setting(chatGroup)
            .setName("Use nested [[]] content")
            .setDesc("Include one level of block refs in context when enabled.")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.include_nested_block_refs).onChange(async (value: boolean) => {
                    this.plugin.settings.include_nested_block_refs = value;
                    await this.plugin.saveSettings();
                    await this.plugin.loadSettings();
                });
            });
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        if (this.plugin.settings.caret_version !== DEFAULT_SETTINGS.caret_version) {
            this.plugin.settings.caret_version = DEFAULT_SETTINGS.caret_version;
        }

        const tabContainer = containerEl.createEl("div", { cls: "caret-tab-container" });
        const modelTab = tabContainer.createEl("button", { text: "Models & generation", cls: "caret-tab is-active" });
        const chatTab = tabContainer.createEl("button", { text: "Chat & logs", cls: "caret-tab" });

        const sectionsContainer = containerEl.createEl("div", { cls: "caret-settings-sections" });
        const modelSection = sectionsContainer.createEl("div", { cls: "caret-settings-section" });
        const chatSection = sectionsContainer.createEl("div", { cls: "caret-settings-section caret-hidden" });

        this.api_settings_tab(modelSection);
        this.chat_settings_tab(chatSection);

        new Setting(containerEl).setDesc(`Caret Version: ${this.plugin.settings.caret_version}`);

        modelTab.addEventListener("click", () => {
            modelTab.classList.add("is-active");
            chatTab.classList.remove("is-active");
            modelSection.classList.remove("caret-hidden");
            chatSection.classList.add("caret-hidden");
        });

        chatTab.addEventListener("click", () => {
            chatTab.classList.add("is-active");
            modelTab.classList.remove("is-active");
            chatSection.classList.remove("caret-hidden");
            modelSection.classList.add("caret-hidden");
        });
    }
}
