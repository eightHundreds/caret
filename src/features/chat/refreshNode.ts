import { ai_sdk_completion, ai_sdk_streaming, get_provider, isEligibleProvider, sdk_provider } from "../../services/llm_calls";
import { CaretCanvas, mergeSettingsAndSparkleConfig } from "../canvas/caret_canvas";
import { buildConversation } from "./conversationBuilder";
import type CaretPlugin from "../../main";
import type { SparkleConfig } from "../../types";
import { updateNodeContent, updateNodeContentStreaming } from "./streaming";

export async function refreshNode(
    plugin: CaretPlugin,
    refreshed_node_id: string,
    system_prompt: string = "",
    sparkle_config: SparkleConfig = {
        model: "default",
        provider: "default",
        temperature: 1,
        context_window: "default",
    }
) {
    let local_system_prompt = system_prompt;

    const caret_canvas = CaretCanvas.fromPlugin(plugin);
    const refreshed_node = caret_canvas.getNode(refreshed_node_id);

    const longest_lineage = refreshed_node.getLongestLineage();
    const parent_node = longest_lineage[1];
    let context_window: string | number = plugin.settings.context_window;
    if (sparkle_config.context_window !== "default") {
        context_window = sparkle_config.context_window;
    }
    if (typeof context_window !== "number" || isNaN(context_window)) {
        throw new Error("Invalid context window: must be a number");
    }

    const { conversation } = await buildConversation(
        plugin,
        parent_node,
        caret_canvas.nodes,
        caret_canvas.edges,
        local_system_prompt,
        context_window
    );

    if (plugin.settings.system_prompt && plugin.settings.system_prompt.trim().length > 0) {
        conversation.unshift({ role: "system", content: plugin.settings.system_prompt.trim() });
    }

    const { provider, model, temperature } = mergeSettingsAndSparkleConfig(plugin.settings, sparkle_config);
    if (!isEligibleProvider(provider)) {
        throw new Error(`Invalid provider: ${provider}`);
    }
    let provider_client: sdk_provider = get_provider(plugin, provider);

    if (plugin.settings.llm_provider_options[provider][model].streaming) {
        const stream = await ai_sdk_streaming(provider_client, model, conversation, temperature, provider);

        updateNodeContent(plugin, refreshed_node_id, "");
        await updateNodeContentStreaming(plugin, refreshed_node_id, stream);
    } else {
        updateNodeContent(plugin, refreshed_node_id, "Refreshing...");
        const content = await ai_sdk_completion(provider_client, model, conversation, temperature, provider);

        refreshed_node.node.text = content;
        updateNodeContent(plugin, refreshed_node_id, content);
    }
}
