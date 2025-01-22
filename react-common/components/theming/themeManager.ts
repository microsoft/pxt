export interface ThemeInfo {
    id: string;
    name: string;
    url: string;
    cssVariables: { [key: string]: string };
}

/*
 * Singleton class to handle theming operations, like loading and switching themes.
*/
export class ThemeManager {
    private static instance: ThemeManager;
    private themes: ThemeInfo[];
    private themeLink: HTMLLinkElement;

    private constructor() {} // private to ensure singleton

    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    private async fetchCssFile(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            pxt.error(`Failed to fetch theme CSS file: ${response.statusText}`);
            return "";
        }
        return response.text();
    }

    private parseCssVariables(cssText: string) {
        const cssVars: { [key: string]: string } = {};
        const varRegex = /--([^:]+):\s*([^;]+);/g;
        let match;
        while ((match = varRegex.exec(cssText)) !== null) {
            cssVars[match[1]] = match[2];
        }
        return cssVars;
    }

    private async cacheThemes(force: boolean) {
        if (this.themes && !force) {
            return;
        }
    
        // TODO thsparks : Load from target somehow? Target config?
        const debugThemeInfo = [
            { id: "light", name: lf("Light"), url: "/docfiles/themes/placeholder.css" },
            { id: "high-contrast", name: lf("High Contrast"), url: "/docfiles/themes/high-contrast.css" },
            { id: "arcade-legacy", name: lf("Legacy"), url: "/docfiles/themes/arcade-legacy.css" }
        ]

        this.themes = [];
        for (const theme of debugThemeInfo) {
            const cssText = await this.fetchCssFile(theme.url);
            const cssVars = this.parseCssVariables(cssText);
            this.themes.push({ ...theme, cssVariables: cssVars });
        }
    }
    
    /*
     * Provides a list of themes available for the app.
     */
    public async getThemes(): Promise<ThemeInfo[]> {
        if (!this.themes) {
            await this.cacheThemes(false);
        }
    
        return this.themes;
    }
    
    public async switchTheme(themeId: string) {
        if (!this.themes) {
            await this.cacheThemes(false);
        }
        const theme = this.themes.find(t => t.id === themeId);
    
        if (!this.themeLink) {
            this.themeLink = document.getElementById('theme-link') as HTMLLinkElement;

            if (!this.themeLink) {
                pxt.error("No theme link found when switching theme");
                return;
            }
        }

        this.themeLink.href = `${theme.url}`;
    }
}

export function getThemeAsStyle(theme: ThemeInfo) {
    const style: React.CSSProperties = {};

    for (const [key, value] of Object.entries(theme.cssVariables)) {
        (style as any)[`--${key}`] = value;
    }

    return style;
}
