import { Color } from "../types/color";

function getHoverColor(color: Color): Color {
    return color.isDarkColor() ? color.getLightened(1.05) : color.getDarkened(1.05);
}

function getForegroundColor(color: Color): Color {
    return color.isDarkColor() ? new Color("#ffffff") : new Color("#000000");
}

function getForegroundHoverColor(color: Color): Color {
    // For now, don't change foreground on hover.
    return getForegroundColor(color);
}

function getStencilColor(color: Color): Color {
    return color.isDarkColor() ? color.getLightened(1.2) : color.getDarkened(1.2);
}

function getAlphaColor(color: Color, alpha: number): Color {
    return color.getWithAlpha(alpha);
}

function getAccentColor(color: Color): Color {
    return color.isDarkColor() ? color.getLightened(1.3) : color.getDarkened(1.3);
}

// This could probably be done with some clever regex but there were a bunch of special cases
// and it was taking too long. This is simpler for now.
interface DerivationInfo {
    colorId: string,
    deriveFrom: (baseColor: Color) => Color
}
const derivationMap: {[baseId: string]: DerivationInfo[]} = {
    "pxt-header-background": [
        { colorId: "pxt-header-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-header-background-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-header-foreground-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-header-stencil", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-primary-background": [
        { colorId: "pxt-primary-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-primary-background-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-primary-foreground-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-primary-accent", deriveFrom: (c) => getAccentColor(c) },
    ],
    "pxt-secondary-background": [
        { colorId: "pxt-secondary-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-secondary-background-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-secondary-foreground-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-secondary-accent", deriveFrom: (c) => getAccentColor(c) },
    ],
    "pxt-tertiary-background": [
        { colorId: "pxt-tertiary-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-tertiary-background-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-tertiary-foreground-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-tertiary-accent", deriveFrom: (c) => getAccentColor(c) },
    ],
    "pxt-target-background1": [
        { colorId: "pxt-target-foreground1", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-target-background1-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-target-foreground1-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-target-stencil1", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-target-background2": [
        { colorId: "pxt-target-foreground2", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-target-background2-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-target-foreground2-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-target-stencil2", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-target-background3": [
        { colorId: "pxt-target-foreground3", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-target-background3-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-target-foreground3-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-target-stencil3", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-neutral-background1": [
        { colorId: "pxt-neutral-foreground1", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-neutral-background1-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-neutral-foreground1-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-neutral-stencil1", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-neutral-background2": [
        { colorId: "pxt-neutral-foreground2", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-neutral-background2-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-neutral-foreground2-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-neutral-stencil2", deriveFrom: (c) => getStencilColor(c) },
    ],
    "pxt-neutral-background3": [
        { colorId: "pxt-neutral-foreground3", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-neutral-background3-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-neutral-foreground3-hover", deriveFrom: (c) => getForegroundHoverColor(c) },
        { colorId: "pxt-neutral-stencil3", deriveFrom: (c) => getStencilColor(c) },
        { colorId: "pxt-neutral-background3-alpha90", deriveFrom: (c) => getAlphaColor(c, 0.9) },
    ],
    "pxt-neutral-base": [
        { colorId: "pxt-neutral-alpha0", deriveFrom: (c) => getAlphaColor(c, 0) },
        { colorId: "pxt-neutral-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
        { colorId: "pxt-neutral-alpha20", deriveFrom: (c) => getAlphaColor(c, 0.2) },
        { colorId: "pxt-neutral-alpha50", deriveFrom: (c) => getAlphaColor(c, 0.5) },
    ],
    "pxt-colors-purple-background": [
        { colorId: "pxt-colors-purple-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-purple-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-purple-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-orange-background": [
        { colorId: "pxt-colors-orange-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-orange-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-orange-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-brown-background": [
        { colorId: "pxt-colors-brown-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-brown-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-brown-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-blue-background": [
        { colorId: "pxt-colors-blue-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-blue-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-blue-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-green-background": [
        { colorId: "pxt-colors-green-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-green-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-green-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-red-background": [
        { colorId: "pxt-colors-red-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-red-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-red-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-teal-background": [
        { colorId: "pxt-colors-teal-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-teal-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-teal-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
    "pxt-colors-yellow-background": [
        { colorId: "pxt-colors-yellow-foreground", deriveFrom: (c) => getForegroundColor(c) },
        { colorId: "pxt-colors-yellow-hover", deriveFrom: (c) => getHoverColor(c) },
        { colorId: "pxt-colors-yellow-alpha10", deriveFrom: (c) => getAlphaColor(c, 0.1) },
    ],
};

export function getColorHeirarchy(colorIds: string[]): { [key: string]: string[] } {
    if (colorIds.length === 0) return {};

    const colorHeirarchy: { [key: string]: string[] } = {};

    for(const baseColor in derivationMap) {
        if (colorIds.some(id => id === baseColor)) {
            const derivedColorIds = derivationMap[baseColor].filter(c => colorIds.includes(c.colorId)).map(c => c.colorId);
            colorHeirarchy[baseColor] = derivedColorIds;
            colorIds = colorIds.filter(id => !derivedColorIds.includes(id) && id !== baseColor);
        }
    }

    // Add any remaining colors as base colors with no derivations
    for(const colorId of colorIds) {
        colorHeirarchy[colorId] = [];
    }
    return colorHeirarchy;
}

export function getDerivedColors(colorId: string, colorValue: string, allColors: { [key: string]: string }): { [key: string]: string } {
    const allColorIds = allColors ? Object.keys(allColors) : [];
    const derivedColors: { [key: string]: string } = {
        [colorId]: colorValue,
    };

    const derivedColorSet = derivationMap[colorId];
    if (!derivedColorSet) {
        // No other colors derive from this one, so return only itself.
        return derivedColors;
    }

    const baseColor = new Color(colorValue);
    for (const derivationInfo of derivedColorSet) {
        if (!allColorIds.includes(derivationInfo.colorId)) {
            // This color doesn't exist in the theme. Indicates an issue with the derivation map above.
            throw new Error(`Color ${derivationInfo.colorId} not found in theme.`);
        }

        const derivedColor = derivationInfo.deriveFrom(baseColor);
        derivedColors[derivationInfo.colorId] = derivedColor.toHex();
    }

    return derivedColors;
}
