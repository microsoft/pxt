export interface ThemeInfo {
    id: string;
    name: string;
    overrides?: string;
    monacoBaseTheme?: string; // https://code.visualstudio.com/docs/getstarted/themes
    colors: { [key: string]: string };
}

interface ThemeChangeSubscriber {
    subscriberId: string;
    onThemeChange: () => void;
}

/*
 * Singleton class to handle theming operations, like loading and switching themes.
*/
export class ThemeManager {
    private static instance: ThemeManager;
    private themes: ThemeInfo[];
    private activeTheme: ThemeInfo;
    private subscribers: ThemeChangeSubscriber[];

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
            "/docfiles/themes/arcade-legacy.json",
            "/docfiles/themes/arcade-dark.json",
            "/docfiles/themes/microbit-light.json",
        ]

        this.themes = [];
        for (const themeFile of debugThemeFiles) {
            const response = await fetch(themeFile);
            if (!response.ok) {
                pxt.error(`Failed to fetch theme JSON file: ${response.statusText}`);
                continue;
            }
            const themeData = await response.json();
            const theme: ThemeInfo = {
                id: themeData.id,
                name: themeData.name,
                monacoBaseTheme: themeData.monacoBaseTheme,
                colors: themeData.colors
            };

            for (const overrideFile of themeData.overrideFiles ?? []) {
                if (!overrideFile) {
                    // Skip empty override file paths
                    continue;
                }

                const overrideStyleResp = await fetch(overrideFile);
                if (!overrideStyleResp.ok) {
                    pxt.error(`Failed to fetch override CSS file: ${overrideStyleResp.statusText}`);
                    continue;
                }
                let cssText = await overrideStyleResp.text();
                theme.overrides = theme.overrides ? `${theme.overrides}\n${cssText}` : cssText;
            }

            this.themes.push(theme);
        }
    }

    public getActiveTheme(): Readonly<ThemeInfo> {
        return this.activeTheme;
    }

    public async getAllThemes(): Promise<ThemeInfo[]> {
        if (!this.themes) {
            await this.cacheThemes(false);
        }
    
        return this.themes;
    }

    // This is a workaround to ensure we still get all the special-case high-contrast styling
    // until we fully support high contrast via color themes (requires a lot of overrides).
    // TODO : this should be removed once we do fully support it.
    private performHighContrastWorkaround(themeId: string) {
        let setBodyClass = (add:boolean, className: string) => {
            const body = document.body;
            const hasClass = document.body.classList.contains(className)
            if (!add && hasClass) {
                body.classList.remove(className);
            } else if (add && !hasClass) {
                body.classList.add(className);
            }
        }

        const isHighContrast = themeId && themeId === pxt.appTarget?.appTheme?.highContrastColorTheme;
        setBodyClass(isHighContrast, "high-contrast");
        setBodyClass(isHighContrast, "hc");
    }

    public async switchTheme(themeId: string) {
        if (themeId === this.getActiveTheme()?.id) {
            return;
        }

        if (!this.themes) {
            await this.cacheThemes(false);
        }
        const theme = this.themes.find(t => t.id === themeId);

        // Programmatically set the CSS variables for the theme
        if (theme) {
            const themeAsStyle = getFullThemeCss(theme);
            const styleElementId = "theme-override";
            let styleElement = document.getElementById(styleElementId);
            if (!styleElement) {
                styleElement = document.createElement("style");
                styleElement.id = styleElementId;
                document.head.appendChild(styleElement);
            }

            // textContent is safer than innerHTML, less vulnerable to XSS
            styleElement.textContent = `.pxt-theme-root { ${themeAsStyle} }`;

            this.performHighContrastWorkaround(themeId);

            this.activeTheme = theme;
            this.notifySubscribers();
        }
    }

    public subscribe(subscriberId: string, onThemeChange: () => void) {
        if (this.subscribers?.some(s => s.subscriberId === subscriberId)) {
            return;
        }

        if (!this.subscribers) {
            this.subscribers = [];
        }

        this.subscribers.push({ subscriberId, onThemeChange });
    }

    public unsubscribe(subscriberId: string) {
        this.subscribers = this.subscribers.filter(s => s.subscriberId !== subscriberId);
    }

    private notifySubscribers() {
        this.subscribers.forEach(s => s.onThemeChange());
    }
}

export function getFullThemeCss(theme: ThemeInfo) {
    let css = "";

    for (const [key, value] of Object.entries(theme.colors)) {
        css += `--${key}: ${value};\n`;
    }

    if (theme.overrides) {
        css += `${theme.overrides}\n`;
    }

    // Sanitize the CSS
    css = DOMPurify.sanitize(css);

    return css;
}
