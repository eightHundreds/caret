import { PluginSettingTab } from "obsidian";
import type CaretPlugin from "../main";
import SettingsRoot from "./settings/SettingsRoot.svelte";

export class CaretSettingTab extends PluginSettingTab {
    plugin: CaretPlugin;
    view: any = null;

    constructor(app: any, plugin: CaretPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        this.view?.$destroy();
        const mount = containerEl.createDiv({ cls: "caret-settings-svelte" });
        this.view = new SettingsRoot({
            target: mount,
            props: {
                plugin: this.plugin,
            },
        });
    }

    hide(): void {
        this.view?.$destroy();
        this.view = null;
    }
}
