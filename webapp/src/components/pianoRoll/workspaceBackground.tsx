import { useEffect, useState } from "react";
import { PianoRollTheme, usePianoRollTheme } from "./context"

function createWorkspaceBackground(
    tickWidth: number,
    ticksPerBeat: number,
    octaveHeight: number,
    borderColor: string = "#1e343d",
    blackKeyColor: string = "#2e4c58",
    backgroundColor: string = "#36535f"
) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${tickWidth * ticksPerBeat}" height="${octaveHeight}">
    <defs>
        <pattern id="grid" width="${tickWidth}" height="${octaveHeight / 12}" patternUnits="userSpaceOnUse">
            <rect width="1" height="${octaveHeight / 12}" fill="${borderColor}" />
            <rect width="${tickWidth}" height="1" fill="${borderColor}" />
        </pattern>
        <pattern id="grid2" width="${tickWidth * ticksPerBeat}" height="${octaveHeight / 12}" patternUnits="userSpaceOnUse">
            <rect width="2" height="${octaveHeight / 12}" fill="${borderColor}" />
        </pattern>
    </defs>
    <rect width="100%" height="100%" fill="${backgroundColor}" />
    ${[1, 3, 5, 8, 10].map(i => `<rect x="0" y="${(octaveHeight / 12) * i}" width="100%" height="${octaveHeight / 12}" fill="${blackKeyColor}" />`).join("")}
    <rect width="100%" height="100%" fill="url(#grid)" />
    <rect width="100%" height="100%" fill="url(#grid2)" />
    <rect x="0" y="0" width="4" height="100%" fill="${borderColor}" />
</svg>
`.trim().replace(/\s+/g, " ")
}

function getBackgroundCss(theme: PianoRollTheme) {
    return `url("data:image/svg+xml,${encodeURIComponent(
        createWorkspaceBackground(
            theme.tickWidth,
            theme.ticksPerBeat,
            7 * theme.whiteKeyHeight,
            theme.gridLineColor,
            theme.blackKeyWorkspaceColor,
            theme.whiteKeyWorkspaceColor
        )
    )}")`;
}

export function useWorkspaceBackground() {
    const theme = usePianoRollTheme();
    const [bg, setBg] = useState(getBackgroundCss(theme));

    useEffect(() => {
        setBg(getBackgroundCss(theme));
    }, [theme.tickWidth, theme.ticksPerBeat, theme.whiteKeyHeight, theme.gridLineColor, theme.blackKeyWorkspaceColor, theme.whiteKeyWorkspaceColor])

    return bg;
}