import { Notice } from "obsidian";
import type CaretPlugin from "../main";

export async function getFrontmatter(plugin: CaretPlugin, file: any) {
    let front_matter: any;
    try {
        await plugin.app.fileManager.processFrontMatter(file, (fm) => {
            front_matter = { ...fm };
        });
    } catch (error) {
        console.error("Error processing front matter:", error);
    }
    return front_matter;
}

export async function getChatLog(plugin: CaretPlugin, folderPath: string, chatId: string) {
    const chatFolder = plugin.app.vault.getFolderByPath(folderPath);
    if (!chatFolder) {
        await plugin.app.vault.createFolder(folderPath);
    }
    let fileToSaveTo = null;

    const folder = plugin.app.vault.getFolderByPath(folderPath);
    let folders_to_check = [folder];
    let num_folders_to_check = 1;
    let num_folders_checked = 0;

    while (num_folders_checked < num_folders_to_check) {
        const folder = folders_to_check[num_folders_checked];
        const children = folder?.children || [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.hasOwnProperty("extension")) {
                // @ts-ignore
                let contents = await plugin.app.vault.cachedRead(child);
                if (!contents) {
                    continue;
                }
                contents = contents.toLowerCase();

                const split_one = contents.split("<id>")[1];
                const id = split_one.split("</id>")[0];
                if (id.toLowerCase() === chatId.toLowerCase()) {
                    fileToSaveTo = child;
                }
            } else {
                // @ts-ignore
                folders_to_check.push(child);
                num_folders_to_check += 1;
            }
        }

        num_folders_checked += 1;
    }
    return fileToSaveTo;
}

export async function extractTextFromPDF(plugin: CaretPlugin, file_name: string): Promise<string> {
    // @ts-ignore
    const file_path = await plugin.app.vault.getResourcePath({
        path: file_name,
    });

    async function loadAndExtractText(file_path: string): Promise<string> {
        try {
            const doc = await plugin.pdfjs.getDocument(file_path).promise;
            const numPages = doc.numPages;

            let fullText = "";
            for (let i = 1; i <= numPages; i++) {
                const page = await doc.getPage(i);
                const content = await page.getTextContent();
                // @ts-ignore
                const pageText = content.items.map((item: { str: string }) => item.str).join(" ");
                fullText += pageText + " ";

                page.cleanup();
            }
            return fullText;
        } catch (err) {
            console.error("Error: " + err);
            throw err;
        }
    }

    const fullDocumentText = await loadAndExtractText(file_path);
    return fullDocumentText;
}
