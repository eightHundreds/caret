import { CaretPluginSettings } from "../types";
import { DEFAULT_CUSTOM_MODELS, LLM_PROVIDER_OPTIONS, PROVIDER_DROPDOWN_OPTIONS } from "./llm-provider-registry";

export const DEFAULT_SETTINGS: CaretPluginSettings = {
    caret_version: "0.2.80",
    chat_logs_folder: "caret/chats",
    chat_logs_date_format_bool: false,
    chat_logs_rename_bool: true,
    chat_send_chat_shortcut: "enter",
    model: "gpt-4o",
    llm_provider: "custom",
    context_window: 128000,
    custom_endpoints: { ...DEFAULT_CUSTOM_MODELS },
    system_prompt: "",
    temperature: 1,
    llm_provider_options: LLM_PROVIDER_OPTIONS,
    provider_dropdown_options: PROVIDER_DROPDOWN_OPTIONS,
    include_nested_block_refs: true,
    image_model: "dall-e-3",
    image_provider: "openai",
    image_model_options: {
        openai: {
            "gpt-image-1": {
                name: "GPT Image 1",
                supported_sizes: ["1024x1024", "1536x1024", "1024x1536"],
            },
            "dall-e-3": {
                name: "DALL-E 3",
                supported_sizes: ["1024x1024", "1792x1024", "1024x1792"],
            },
        },
    },
    image_provider_dropdown_options: {
        openai: "OpenAI",
    },
};
