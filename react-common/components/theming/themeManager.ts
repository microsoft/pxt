interface ThemeChangeSubscriber {
    subscriberId: string;
    onColorThemeChange: () => void;
}

/*
 * Singleton class to handle theming operations, like loading and switching themes.
 * Using singleton to simplify subscribers and alerting.
*/
export class ThemeManager {
    private static instance: ThemeManager;
    private currentTheme: pxt.ColorThemeInfo;
    private subscribers: ThemeChangeSubscriber[];

    private constructor() {} // private to ensure singleton

    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    public getCurrentColorTheme(): Readonly<pxt.ColorThemeInfo> {
        return this.currentTheme;
    }

    public getAllColorThemes(): pxt.ColorThemeInfo[] {
        return pxt.appTarget?.colorThemeMap ? Object.values(pxt.appTarget.colorThemeMap) : [];
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

    public async switchColorTheme(themeId: string) {
        if (themeId === this.getCurrentColorTheme()?.id) {
            return;
        }

        const theme = pxt.appTarget?.colorThemeMap?.[themeId];

        // Programmatically set the CSS variables for the theme
        if (theme) {
            const themeAsStyle = getFullColorThemeCss(theme);
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

            this.currentTheme = theme;
            this.notifySubscribers();
        }
    }

    public subscribe(subscriberId: string, onColorThemeChange: () => void) {
        if (this.subscribers?.some(s => s.subscriberId === subscriberId)) {
            return;
        }

        if (!this.subscribers) {
            this.subscribers = [];
        }

        this.subscribers.push({ subscriberId, onColorThemeChange });
    }

    public unsubscribe(subscriberId: string) {
        this.subscribers = this.subscribers.filter(s => s.subscriberId !== subscriberId);
    }

    private notifySubscribers() {
        this.subscribers.forEach(s => s.onColorThemeChange());
    }
}

export function getFullColorThemeCss(theme: pxt.ColorThemeInfo) {
    let css = "";

    for (const [key, value] of Object.entries(theme.colors)) {
        css += `--${key}: ${value};\n`;
    }

    if (theme.overrideCss) {
        css += `${theme.overrideCss}\n`;
    }

    // Sanitize the CSS
    css = DOMPurify.sanitize(css);

    return css;
}
