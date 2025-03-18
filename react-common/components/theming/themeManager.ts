/// <reference path='../../../localtypings/dompurify.d.ts' />

interface ThemeChangeSubscriber {
    subscriberId: string;
    onColorThemeChange: () => void;
}

/*
 * Class to handle theming operations, like loading and switching themes.
 * Each instance can manage themes for a specific document.
*/
export class ThemeManager {
    private static instances: Map<Document, ThemeManager> = new Map();
    private currentTheme: pxt.ColorThemeInfo;
    private subscribers: ThemeChangeSubscriber[];
    private document: Document;

    private constructor(doc: Document) {
        this.document = doc;
    }

    public static getInstance(doc: Document = document): ThemeManager {
        if (!ThemeManager.instances.has(doc)) {
            ThemeManager.instances.set(doc, new ThemeManager(doc));
        }
        return ThemeManager.instances.get(doc);
    }

    public getCurrentColorTheme(): Readonly<pxt.ColorThemeInfo> {
        return this.currentTheme;
    }

    public isKnownTheme(themeId: string): boolean {
        return !!pxt.appTarget?.colorThemeMap?.[themeId];
    }

    public getAllColorThemes(): pxt.ColorThemeInfo[] {
        const allThemes = pxt.appTarget?.colorThemeMap ? Object.values(pxt.appTarget.colorThemeMap) : [];
        return allThemes.sort((a, b) => {
            // Lower weight at the front.
            if (a.weight !== b.weight) {
                return (a.weight ?? Infinity) - (b.weight ?? Infinity);
            }
            else {
                return a.id.localeCompare(b.id);
            }
        });
    }

    public isHighContrast(themeId: string) {
        return themeId && themeId === pxt.appTarget?.appTheme?.highContrastColorTheme;
    }

    // This is a workaround to ensure we still get all the special-case high-contrast styling
    // until we fully support high contrast via color themes (requires a lot of overrides).
    // TODO : this should be removed once we do fully support it.
    private performHighContrastWorkaround(themeId: string) {
        if (this.isHighContrast(themeId)) {
            this.document.body.classList.add("high-contrast");
            this.document.body.classList.add("hc");
        } else {
            this.document.body.classList.remove("high-contrast");
            this.document.body.classList.remove("hc");
        }
    }

    public switchColorTheme(themeId: string) {
        if (themeId === this.getCurrentColorTheme()?.id) {
            return;
        }

        const theme = pxt.appTarget?.colorThemeMap?.[themeId];

        // Programmatically set the CSS variables for the theme
        if (theme) {
            const themeAsStyle = getFullColorThemeCss(theme);
            const styleElementId = "theme-override";
            let styleElement = this.document.getElementById(styleElementId);
            if (!styleElement) {
                styleElement = this.document.createElement("style");
                styleElement.id = styleElementId;
                this.document.head.appendChild(styleElement);
            }

            // textContent is safer than innerHTML, less vulnerable to XSS
            styleElement.textContent = `.pxt-theme-root { ${themeAsStyle} }`;

            this.performHighContrastWorkaround(themeId);
            pxt.toolbox.setUseAutoAccessibleColors(!theme.legacyBlockColors);

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
        this.subscribers?.forEach(s => s.onColorThemeChange());
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
