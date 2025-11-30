import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { CaretPluginSettings } from "../types";
import type { sdk_provider, image_provider } from "./llm_calls";

export type ProviderClientMap = Record<string, sdk_provider>;
export type ImageProviderKey = "openai";
export type ImageProviderMap = Partial<Record<ImageProviderKey, image_provider>>;

function getModelConfig(settings: CaretPluginSettings, modelId: string) {
    return settings.custom_endpoints[modelId];
}

export function createProviderClient(modelId: string, settings: CaretPluginSettings): sdk_provider | null {
    const config = getModelConfig(settings, modelId);
    if (!config?.endpoint || !config?.api_key) return null;
    return createOpenAICompatible({
        apiKey: config.api_key,
        baseURL: config.endpoint,
        name: "custom",
    });
}

export function createImageProvider(provider: ImageProviderKey, settings: CaretPluginSettings): image_provider | null {
    if (provider !== "openai") return null;
    const modelConfig = getModelConfig(settings, settings.model);
    if (!modelConfig?.api_key) return null;
    return createOpenAI({ apiKey: modelConfig.api_key });
}

export function buildProviderMaps(settings: CaretPluginSettings) {
    const llmProviders: ProviderClientMap = {};
    const client = createProviderClient(settings.model, settings);
    if (client) {
        llmProviders[settings.model] = client;
    }

    const imageProviders: ImageProviderMap = {};
    const openaiImage = createImageProvider("openai", settings);
    if (openaiImage) imageProviders.openai = openaiImage;

    return { llmProviders, imageProviders };
}
