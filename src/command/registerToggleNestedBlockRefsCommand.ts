import type CaretPlugin from "../main";

export function registerToggleNestedBlockRefsCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "toggle-nested-block-refs",
        name: "Toggle Including Nested Block Refs",
        callback: async () => {
            plugin.settings.include_nested_block_refs = !plugin.settings.include_nested_block_refs;
            await plugin.saveSettings();
        },
    });
}
