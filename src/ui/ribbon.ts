import { VIEW_CHAT } from "./views/chat";
import type CaretPlugin from "../main";

export function addChatIconToRibbon(plugin: CaretPlugin) {
    plugin.addRibbonIcon("message-square", "Caret Chat", async () => {
        await plugin.app.workspace.getLeaf(true).setViewState({
            type: VIEW_CHAT,
            active: true,
        });
    });
}

export function addCaretCanvasIcon(plugin: CaretPlugin) {
    plugin.addRibbonIcon("message-square", "Caret Chat", async () => {
        await plugin.app.workspace.getLeaf(true).setViewState({
            type: VIEW_CHAT,
            active: true,
        });
    });
}
