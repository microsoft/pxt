export interface ThemeInfo {
    id: string;
    name: string;
    colors: { [key: string]: string };
}

/*
 * Singleton class to handle theming operations, like loading and switching themes.
*/
export class ThemeManager {
    private static instance: ThemeManager;
    private themes: ThemeInfo[];
    private activeTheme: ThemeInfo;

    private constructor() {} // private to ensure singleton

    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    private async cacheThemes(force: boolean) {
        if (this.themes && !force) {
            return;
        }
    
        // TODO thsparks : Load from target somehow? pxtarget config? Something like availableLocales in apptarget.apptheme in (used for languages)? Could also include paths there.
        const debugThemeFiles = [
            "/docfiles/themes/arcade-light.json",
            "/docfiles/themes/high-contrast.json",
            "/docfiles/themes/arcade-legacy.json"
        ]

        this.themes = [];
        for (const themeFile of debugThemeFiles) {
            const response = await fetch(themeFile);
            if (!response.ok) {
                pxt.error(`Failed to fetch theme JSON file: ${response.statusText}`);
                continue;
            }
            const themeJson = await response.json();
            this.themes.push(themeJson);
        }
    }

    public getActiveThemeId(): string {
        return this.activeTheme?.id;
    }

    public async getAllThemes(): Promise<ThemeInfo[]> {
        if (!this.themes) {
            await this.cacheThemes(false);
        }
    
        return this.themes;
    }
    
    public async switchTheme(themeId: string) {
        if (themeId === this.getActiveThemeId()) {
            return;
        }

        if (!this.themes) {
            await this.cacheThemes(false);
        }
        const theme = this.themes.find(t => t.id === themeId);

        // Programmatically set the CSS variables for the theme
        if (theme) {
            const themeAsStyle = getThemeAsStyle(theme);
            for (const [key, value] of Object.entries(themeAsStyle)) {
                document.documentElement.style.setProperty(key, value);
            }
        }
    }
}

export function getThemeAsStyle(theme: ThemeInfo) {
    const style: React.CSSProperties = {};

    for (const [key, value] of Object.entries(theme.colors)) {
        (style as any)[`--${key}`] = value;
    }

    return style;
}
