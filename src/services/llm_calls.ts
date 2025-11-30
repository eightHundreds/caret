import { Notice } from "obsidian";
import { streamText, StreamTextResult, CoreTool, generateText, generateObject, experimental_generateImage as generateImage } from "ai";
import { createOpenAICompatible, OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { OpenAIProvider } from "@ai-sdk/openai";
import { z } from "zod";
import type CaretPlugin from "../main";
import { ensureModelSettings } from "../config/llm-provider-registry";

// Zod validation for message structure
const MessageSchema = z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
});

const ConversationSchema = z.array(MessageSchema);

export type sdk_provider = OpenAICompatibleProvider;
export type eligible_provider = "custom";

export type image_provider = OpenAIProvider;

export const isEligibleProvider = (_provider: string): _provider is eligible_provider => {
    return true;
};

export function get_provider(plugin: CaretPlugin, _provider?: eligible_provider): sdk_provider {
    ensureModelSettings(plugin.settings);
    const settings = plugin.settings;
    const current_model = settings.model;
    const custom_endpoint = settings.custom_endpoints[current_model];

    if (!custom_endpoint) {
        throw new Error(`模型 ${current_model} 的 endpoint 未配置`);
    }
    if (!custom_endpoint.endpoint) {
        throw new Error(`模型 ${current_model} 缺少 endpoint`);
    }
    if (!custom_endpoint.api_key) {
        throw new Error(`模型 ${current_model} 缺少 API key`);
    }

    const cached = (plugin as any)._cached_custom_client as {
        provider?: sdk_provider;
        modelId?: string;
        endpoint?: string;
        apiKey?: string;
    };

    if (
        cached?.provider &&
        cached.modelId === current_model &&
        cached.endpoint === custom_endpoint.endpoint &&
        cached.apiKey === custom_endpoint.api_key
    ) {
        return cached.provider;
    }

    const sdk_provider = createOpenAICompatible({
        baseURL: custom_endpoint.endpoint,
        apiKey: custom_endpoint.api_key,
        name: "custom",
    });

    (plugin as any)._cached_custom_client = {
        provider: sdk_provider,
        modelId: current_model,
        endpoint: custom_endpoint.endpoint,
        apiKey: custom_endpoint.api_key,
    };
    plugin.custom_client = sdk_provider;
    return plugin.custom_client;
}

function validateConversation(conversation: Array<{ role: string; content: string }>) {
    return ConversationSchema.parse(conversation);
}

export async function ai_sdk_streaming(
    provider: sdk_provider,
    model: string,
    conversation: Array<{ role: string; content: string }>,
    temperature: number,
    provider_name: string
): Promise<StreamTextResult<Record<string, CoreTool<any, any>>, never>> {
    const displayLabel = provider_name && provider_name !== "custom" ? provider_name : model;
    new Notice(`调用 ${displayLabel}`);

    const validatedConversation = validateConversation(conversation);

    const handleError = (event: unknown) => {
        const error = (event as { error: unknown }).error;
        const typedError = error as { errors: Array<{ statusCode: number }> };
        const errors = typedError.errors;

        if (errors?.some((e) => e.statusCode === 429)) {
            console.error("Rate limit exceeded error");
            new Notice(`模型 ${displayLabel} 触发限速`);
        } else {
            new Notice(`调用 ${displayLabel} 出现未知错误`);
        }
    };

    return streamText({
        model: provider(model),
        messages: validatedConversation,
        temperature,
        onError: handleError,
    });
}
export async function ai_sdk_completion(
    provider: sdk_provider,
    model: string,
    conversation: Array<{ role: string; content: string }>,
    temperature: number,
    provider_name: string
): Promise<string> {
    const displayLabel = provider_name && provider_name !== "custom" ? provider_name : model;
    new Notice(`调用 ${displayLabel}`);

    const validatedConversation = validateConversation(conversation);

    const response = await generateText({
        model: provider(model),
        messages: validatedConversation,
        temperature,
    });

    return response.text;
}
export async function ai_sdk_structured<T extends z.ZodType>(
    provider: sdk_provider,
    model: string,
    conversation: Array<{ role: string; content: string }>,
    temperature: number,
    provider_name: string,
    schema: T
): Promise<z.infer<T>> {
    const displayLabel = provider_name && provider_name !== "custom" ? provider_name : model;
    new Notice(`调用 ${displayLabel}`);

    const validatedConversation = validateConversation(conversation);

    const response = await generateObject({
        model: provider(model),
        schema,
        messages: validatedConversation,
        temperature,
    });

    return response.object;
}

export async function ai_sdk_image_gen(params: { provider: image_provider; prompt: string; model: string }) {
    const model = params.model;
    const { image } = await generateImage({
        model: params.provider.image(model),
        prompt: params.prompt,
    });
    const arrayBuffer = image.uint8Array;
    return arrayBuffer;
}
