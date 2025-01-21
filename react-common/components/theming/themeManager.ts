export interface ThemeInfo {
    id: string;
    name: string;
    url: string;
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

    private async cacheThemes(force: boolean) {
        if (this.themes && !force) {
            return;
        }
    
        // TODO thsparks : Load from target somehow? Target config?
        this.themes = [
            { id: "light", name: lf("Light"), url: "/docfiles/themes/placeholder.css" },
            { id: "dark", name: lf("High Contrast"), url: "/docfiles/themes/high-contrast.css" },
        ]
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
