import type { CaretPluginSettings, CustomModels, LLMProviderOptions, Models } from "../types";

export type ProviderKey = "custom";

export const DEFAULT_MODEL_META: Models = {
    name: "default",
    context_window: 128000,
    function_calling: true,
    vision: true,
    streaming: true,
};

export const DEFAULT_CUSTOM_MODELS: Record<string, CustomModels> = {
    "gpt-4o": {
        ...DEFAULT_MODEL_META,
        name: "GPT-4o",
        endpoint: "https://api.openai.com/v1",
        api_key: "",
    },
};

export const PROVIDER_DROPDOWN_OPTIONS: Record<ProviderKey, string> = {
    custom: "OpenAI 兼容",
};

export function buildProviderOptions(customModels: Record<string, CustomModels>): LLMProviderOptions {
    const customOptions = Object.fromEntries(
        Object.entries(customModels).map(([modelId, model]) => [
            modelId,
            {
                name: model.name || modelId,
                context_window: model.context_window ?? DEFAULT_MODEL_META.context_window,
                function_calling: model.function_calling ?? DEFAULT_MODEL_META.function_calling,
                vision: model.vision ?? DEFAULT_MODEL_META.vision,
                streaming: model.streaming ?? DEFAULT_MODEL_META.streaming,
            },
        ])
    );

    return {
        custom: customOptions,
    };
}

export const LLM_PROVIDER_OPTIONS: LLMProviderOptions = buildProviderOptions(DEFAULT_CUSTOM_MODELS);

export function ensureModelSettings(settings: CaretPluginSettings) {
    if (!settings.custom_endpoints || Object.keys(settings.custom_endpoints).length === 0) {
        settings.custom_endpoints = { ...DEFAULT_CUSTOM_MODELS };
    }
    Object.entries(settings.custom_endpoints).forEach(([key, value]) => {
        if (value.pinned === undefined) {
            value.pinned = false;
        }
        if (!value.name) {
            value.name = key;
        }
    });

    settings.llm_provider_options = buildProviderOptions(settings.custom_endpoints);
    settings.provider_dropdown_options = { ...PROVIDER_DROPDOWN_OPTIONS };
    settings.llm_provider = "custom";

    if (!settings.model || !settings.custom_endpoints[settings.model]) {
        const firstModel = Object.keys(settings.custom_endpoints)[0];
        settings.model = firstModel;
    }

    const modelConfig = settings.custom_endpoints[settings.model];
    settings.context_window = modelConfig?.context_window ?? DEFAULT_MODEL_META.context_window;
}
