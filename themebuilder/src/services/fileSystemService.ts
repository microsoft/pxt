// Serializes the given theme and writes it to a file.

import { setCurrentEditingTheme } from "../transforms/setCurrentEditingTheme";

// Returns true if the file was written successfully, false otherwise.
export function exportTheme(theme: pxt.ColorThemeInfo): boolean {
    if (!theme?.id) return false;

    const fileName = `${pxt.Util.sanitizeFileName(theme.id)}.json`;

    // Write content to the given path on disk.
    const themeJson = JSON.stringify(theme, null, 4);

    try {
        pxt.BrowserUtils.browserDownloadText(themeJson, fileName);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function importThemeFromFileAsync(file: File): Promise<boolean> {
    try {
        const themeJson = await pxt.Util.fileReadAsTextAsync(file);
        const theme = JSON.parse(themeJson) as pxt.ColorThemeInfo;
        setCurrentEditingTheme(theme);
        return true;
    } catch (error) {
        console.error("Unable to parse theme.", error);
        return false;
    }
}
