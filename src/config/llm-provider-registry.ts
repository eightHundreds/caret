import type { CaretPluginSettings, LLMProviderOptions, Models } from "../types";

type ProviderRegistryEntry = {
    label: string;
    apiKeyField?: keyof CaretPluginSettings;
    models: string[];
};

const DEFAULT_MODEL_META: Models = {
    name: "default",
    context_window: 128000,
    function_calling: true,
    vision: true,
    streaming: true,
};

export const LLM_PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
    openai: { label: "OpenAI", apiKeyField: "openai_api_key", models: ["gpt-4o"] },
    groq: { label: "Groq", apiKeyField: "groq_api_key", models: ["llama3-70b-8192"] },
    anthropic: { label: "Anthropic", apiKeyField: "anthropic_api_key", models: ["claude-3.5-sonnet"] },
    openrouter: { label: "OpenRouter", apiKeyField: "open_router_key", models: ["anthropic/claude-3.5-sonnet"] },
    ollama: { label: "Ollama", models: ["llama3.1"] },
    custom: { label: "Custom", models: ["custom"] },
    google: { label: "Google Gemini", apiKeyField: "google_api_key", models: ["gemini-2.0-flash"] },
    deepseek: { label: "DeepSeek", apiKeyField: "deepseek_api_key", models: ["deepseek-chat"] },
    perplexity: { label: "Perplexity", apiKeyField: "perplexity_api_key", models: ["llama-3.1-sonar-small-128k-online"] },
};

export function buildProviderOptions(registry = LLM_PROVIDER_REGISTRY): LLMProviderOptions {
    return Object.fromEntries(
        Object.entries(registry).map(([provider, def]) => {
            const models = def.models.length > 0 ? def.models : ["default"];
            const modelOptions = Object.fromEntries(
                models.map((model) => [
                    model,
                    {
                        ...DEFAULT_MODEL_META,
                        name: model,
                    },
                ])
            );
            return [provider, modelOptions];
        })
    ) as LLMProviderOptions;
}

export const LLM_PROVIDER_OPTIONS: LLMProviderOptions = buildProviderOptions();

export const PROVIDER_DROPDOWN_OPTIONS = Object.fromEntries(
    Object.entries(LLM_PROVIDER_REGISTRY).map(([key, def]) => [key, def.label])
);

export const API_KEY_CONFIG = Object.fromEntries(
    Object.entries(LLM_PROVIDER_REGISTRY)
        .filter(([, def]) => !!def.apiKeyField)
        .map(([key, def]) => [key, { label: def.label, placeholder: `${def.label} API key`, keyField: def.apiKeyField! }])
);

export function getModelById(modelId: string) {
    const [provider, ...rest] = modelId.split(":");
    const model = rest.join(":");
    const providerDef = LLM_PROVIDER_REGISTRY[provider];
    const modelConfig = providerDef?.models?.includes(model)
        ? { ...DEFAULT_MODEL_META, name: model }
        : { ...DEFAULT_MODEL_META, name: model };
    return { provider, model, config: modelConfig };
}

export type ProviderKey = keyof typeof LLM_PROVIDER_REGISTRY;
