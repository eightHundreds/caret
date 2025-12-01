import type CaretPlugin from "../main";
import { createLinearWorkflowFromCanvas } from "../features/workflow/linearWorkflow";

export function registerCreateLinearWorkflowCommand(plugin: CaretPlugin) {
    plugin.addCommand({
        id: "create-linear-workflow",
        name: "Create linear workflow from canvas",
        checkCallback: (checking: boolean) => {
            const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
            let on_canvas = false;

            // @ts-ignore
            if (canvas_view?.canvas) {
                on_canvas = true;
            }
            // @ts-ignore TODO: Type this better
            if (on_canvas) {
                if (!checking) {
                    // @ts-ignore
                    const canvas = canvas_view.canvas;
                    await createLinearWorkflowFromCanvas(plugin, canvas);
                }

                return true;
            }
            return false;
        },
    });
}
