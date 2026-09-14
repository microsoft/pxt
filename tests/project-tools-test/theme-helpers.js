"use strict";

const fs = require("fs");
const path = require("path");

function colorThemes() {
    // Always exercise opposing toolbar/surface foregrounds, even in core-only CI.
    const themes = new Map([
        ["regression-light", { id: "regression-light", colors: {
            "pxt-target-background1": "#f8fafc", "pxt-target-foreground1": "#000000",
            "pxt-target-background1-hover": "#d4e0ed", "pxt-target-foreground1-hover": "#000000",
            "pxt-primary-background": "#5d4fba", "pxt-primary-foreground": "#ffffff",
            "pxt-neutral-background1": "#ffffff", "pxt-neutral-foreground1": "#000000",
            "pxt-neutral-alpha20": "rgba(0,0,0,.2)", "pxt-focus-border": "#0078d4"
        } }],
        ["regression-dark", { id: "regression-dark", colors: {
            "pxt-target-background1": "#1a1b26", "pxt-target-foreground1": "#c0caf5",
            "pxt-target-background1-hover": "#24283b", "pxt-target-foreground1-hover": "#ffffff",
            "pxt-primary-background": "#7aa2f7", "pxt-primary-foreground": "#16161e",
            "pxt-neutral-background1": "#1a1b26", "pxt-neutral-foreground1": "#c0caf5",
            "pxt-neutral-alpha20": "rgba(192,202,245,.2)", "pxt-focus-border": "#bb9af7"
        } }]
    ]);
    // Match the target builder: shared themes first, then target overrides.
    const roots = [path.resolve("theme/color-themes"),
        path.join(process.env.PXT_ARCADE_PATH || path.resolve("../pxt-arcade"), "theme/color-themes")];
    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        for (const file of fs.readdirSync(root).filter(file => file.endsWith(".json")).sort()) {
            const theme = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
            const previous = themes.get(theme.id);
            if (theme.overrideFiles) theme.overrideCss = theme.overrideFiles.filter(Boolean)
                .map(file => fs.readFileSync(path.join(root, file.replace(/^[\\/]+/, "")), "utf8")).join("\n");
            themes.set(theme.id, { ...previous, ...theme, colors: { ...previous?.colors, ...theme.colors } });
        }
    }
    return [...themes.values()];
}

async function contrastSamples(page, selector) {
    return page.$$eval(selector, elements => {
        const rgba = color => {
            if (!/^rgba?\(/.test(color)) throw new Error(`Unexpected computed color: ${color}`);
            const values = color.match(/[\d.]+/g).map(Number);
            return [values[0], values[1], values[2], values.length === 4 ? values[3] : 1];
        };
        const over = (color, background) => color.slice(0, 3).map((value, i) => value * color[3] + background[i] * (1 - color[3]));
        const luminance = color => color.map(value => {
            const s = value / 255;
            return s <= .04045 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
        }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
        return elements.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden").map(el => {
            const ancestors = [];
            for (let parent = el; parent; parent = parent.parentElement) ancestors.unshift(parent);
            const background = ancestors.reduce((background, parent) => over(rgba(getComputedStyle(parent).backgroundColor), background), [255, 255, 255]);
            const style = getComputedStyle(el);
            const isFilledSvg = el instanceof SVGElement && style.fill !== "none";
            const foreground = rgba(isFilledSvg ? style.fill : style.color);
            if (isFilledSvg) foreground[3] *= Number(style.fillOpacity);
            return {
                label: el.id || el.getAttribute("aria-label") || el.textContent.trim() || el.className,
                color: style.color,
                background,
                contrast: contrast(over(foreground, background), background),
                outlineContrast: contrast(over(rgba(style.outlineColor), background), background),
                outlineWidth: parseFloat(style.outlineWidth),
                outlineStyle: style.outlineStyle,
                filter: style.filter
            };
        });
    });
}

module.exports = { colorThemes, contrastSamples };