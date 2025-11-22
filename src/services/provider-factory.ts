import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai";
import { AnthropicProvider, createAnthropic } from "@ai-sdk/anthropic";
import { createGroq, GroqProvider } from "@ai-sdk/groq";
import { createOllama, OllamaProvider } from "ollama-ai-provider";
import { createOpenRouter, OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible, OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { createXai, XaiProvider } from "@ai-sdk/xai";
import type { CaretPluginSettings } from "../types";
import { API_KEY_CONFIG, LLM_PROVIDER_REGISTRY, ProviderKey } from "../config/llm-provider-registry";
import type { sdk_provider, image_provider } from "./llm_calls";

export type ProviderClientMap = Partial<Record<ProviderKey, sdk_provider>>;
export type ImageProviderKey = "openai" | "xai";
export type ImageProviderMap = Partial<Record<ImageProviderKey, image_provider>>;

function getApiKey(settings: CaretPluginSettings, provider: ProviderKey): string | undefined {
    const config = API_KEY_CONFIG[provider as keyof typeof API_KEY_CONFIG];
    if (!config) return undefined;
    return (settings as any)[config.keyField] as string | undefined;
}

export function createProviderClient(provider: ProviderKey, settings: CaretPluginSettings): sdk_provider | null {
    switch (provider) {
        case "openai": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createOpenAI({ apiKey });
        }
        case "groq": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createGroq({ apiKey });
        }
        case "anthropic": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createAnthropic({
                apiKey,
                headers: {
                    "anthropic-dangerous-direct-browser-access": "true",
                },
            });
        }
        case "google": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createGoogleGenerativeAI({ apiKey });
        }
        case "openrouter": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createOpenRouter({ apiKey });
        }
        case "perplexity": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createOpenAICompatible({
                apiKey,
                baseURL: "https://api.perplexity.ai/",
                name: "perplexity",
            });
        }
        case "deepseek": {
            const apiKey = getApiKey(settings, provider);
            if (!apiKey) return null;
            return createOpenAICompatible({
                apiKey,
                baseURL: "https://api.deepseek.com",
                name: "deepseek",
            });
        }
        case "ollama": {
            return createOllama();
        }
        case "custom": {
            // Custom 由 get_provider 按当前模型配置动态创建
            return null;
        }
        default:
            return null;
    }
}

export function createImageProvider(provider: ImageProviderKey, settings: CaretPluginSettings): image_provider | null {
    switch (provider) {
        case "openai": {
            const client = createProviderClient("openai", settings);
            return client as unknown as image_provider;
        }
        case "xai": {
            const apiKey = settings.xai_api_key;
            if (!apiKey) return null;
            return createXai({ apiKey });
        }
        default:
            return null;
    }
}

export function buildProviderMaps(settings: CaretPluginSettings) {
    const llmProviders: ProviderClientMap = {};
    (Object.keys(LLM_PROVIDER_REGISTRY) as ProviderKey[]).forEach((provider) => {
        const client = createProviderClient(provider, settings);
        if (client) {
            llmProviders[provider] = client;
        }
    });

    const imageProviders: ImageProviderMap = {};
    const openaiImage = createImageProvider("openai", settings);
    if (openaiImage) imageProviders.openai = openaiImage;
    const xaiImage = createImageProvider("xai", settings);
    if (xaiImage) imageProviders.xai = xaiImage;

    return { llmProviders, imageProviders };
}
