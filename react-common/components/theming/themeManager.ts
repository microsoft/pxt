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

    public getAllColorThemes(): pxt.ColorThemeInfo[] {
        return pxt.appTarget?.colorThemeMap ? Object.values(pxt.appTarget.colorThemeMap) : [];
    }

    // This is a workaround to ensure we still get all the special-case high-contrast styling
    // until we fully support high contrast via color themes (requires a lot of overrides).
    // TODO : this should be removed once we do fully support it.
    private performHighContrastWorkaround(themeId: string) {
        let setBodyClass = (add:boolean, className: string) => {
            const body = this.document.body;
            const hasClass = body.classList.contains(className);
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
    // TODO thsparks - get this working in skillmap somehow...
    // css = DOMPurify.sanitize(css);

    return css;
}
