export interface Palette {
    name: string;
    id: string;
    colors: string[];
    custom?: boolean;
}

export const Adafruit: Palette = {
    id: "Adafruit",
    name: lf("Adafruit"),
    colors: [
        "#000000",
        "#FFFFFF",
        "#FF0000",
        "#FF007D",
        "#FF7a00",
        "#e5FF00",
        "#2D9F00",
        "#00FF72",
        "#0034FF",
        "#17ABFF",
        "#C600FF",
        "#636363",
        "#7400DB",
        "#00EFFF",
        "#DF2929",
        "#000000",
    ]
}

// https://lospec.com/palette-list/vanilla-milkshake missing #e9f59d
export const Pastel: Palette = {
    id: "Pastel",
    name: lf("Pastel"),
    colors: [
        "#000000",
        "#fff7e4",
        "#f98284",
        "#feaae4",
        "#ffc384",
        "#fff7a0",
        "#87a889",
        "#b0eb93",
        "#b0a9e4",
        "#accce4",
        "#b3e3da",
        "#d9c8bf",
        "#6c5671",
        "#ffe6c6",
        "#dea38b",
        "#28282e",
    ]
}


export const Matte: Palette = {
    id: "Matte",
    name: lf("Matte"),
    colors: [
        "#000000",
        "#FFF1E8",
        "#FF004D",
        "#FF77A8",
        "#FFA300",
        "#FFEC27",
        "#008751",
        "#00E436",
        "#29ADFF",
        "#C2C3C7",
        "#7E2553",
        "#83769C",
        "#5F574F",
        "#FFCCAA",
        "#AB5236",
        "#1D2B53",
    ]
}


export const Grayscale: Palette = {
    id: "Grayscale",
    name: lf("Grayscale"),
    colors: [
        "#000000",
        "#FFFFFF",
        "#EDEDED",
        "#DBDBDB",
        "#C8C8C8",
        "#B6B6B6",
        "#A4A4A4",
        "#929292",
        "#808080",
        "#6D6D6D",
        "#5B5B5B",
        "#494949",
        "#373737",
        "#242424",
        "#121212",
        "#000000",
    ]
}


// https://lospec.com/palette-list/poke14 with #b56edd added for purple
export const Poke: Palette = {
    id: "Poke",
    name: lf("Poke"),
    colors: [
        "#000000",
        "#ffffff",
        "#d45362",
        "#e8958b",
        "#cc8945",
        "#f5dc8c",
        "#417d53",
        "#5dd48f",
        "#5162c2",
        "#6cadeb",
        "#b56edd",
        "#8f3f29",
        "#612431",
        "#c0fac2",
        "#24325e",
        "#1b1221",
    ]
}


// https://lospec.com/palette-list/warioware-diy
export const DIY: Palette = {
    id: "DIY",
    name: lf("DIY"),
    colors: [
        "#000000",
        "#f8f8f8",
        "#f80000",
        "#FF93C4",
        "#f8a830",
        "#f8f858",
        "#089050",
        "#70d038",
        "#2868c0",
        "#10c0c8",
        "#c868e8",
        "#c0c0c0",
        "#787878",
        "#f8d898",
        "#c04800",
        "#000000",
    ]
}


// https://lospec.com/palette-list/still-life
export const StillLife: Palette = {
    id: "StillLife",
    name: lf("Still Life"),
    colors: [
        "#000000",
        "#a8e4d4",
        "#d13b27",
        "#e07f8a",
        "#cc8218",
        "#b3e868",
        "#5d853a",
        "#68c127",
        "#286fb8",
        "#9b8bff",
        "#3f2811",
        "#513155",
        "#122615",
        "#c7b581",
        "#7a2222",
        "#000000",
    ]
}


// https://lospec.com/palette-list/steam-lords, missing 0xa0b9ba
export const SteamPunk: Palette = {
    id: "SteamPunk",
    name: lf("Steam Punk"),
    colors: [
        "#000000",
        "#c0d1cc",
        "#603b3a",
        "#170e19",
        "#775c4f",
        "#77744f",
        "#4f7754",
        "#a19f7c",
        "#4f5277",
        "#65738c",
        "#3a604a",
        "#213b25",
        "#433a60",
        "#7c94a1",
        "#3b2137",
        "#2f213b",
    ]
}

// https://lospec.com/palette-list/sweetie-16, missing 0x73eff7
export const Sweet: Palette = {
    id: "Sweet",
    name: lf("Sweet"),
    colors: [
        "#000000",
        "#f4f4f4",
        "#b13e53",
        "#a7f070",
        "#ef7d57",
        "#ffcd75",
        "#257179",
        "#38b764",
        "#29366f",
        "#3b5dc9",
        "#41a6f6",
        "#566c86",
        "#333c57",
        "#94b0c2",
        "#5d275d",
        "#1a1c2c",
    ]
}


// https://lospec.com/palette-list/na16, missing 0x70377f
export const Adventure: Palette = {
    id: "Adventure",
    name: lf("Adventure"),
    colors: [
        "#000000",
        "#f5edba",
        "#9d303b",
        "#d26471",
        "#e4943a",
        "#c0c741",
        "#647d34",
        "#34859d",
        "#17434b",
        "#7ec4c1",
        "#584563",
        "#8c8fae",
        "#3e2137",
        "#d79b7d",
        "#9a6348",
        "#1f0e1c",
    ]
}


//% fixedInstance whenUsed block="arcade"
export const Arcade: Palette = {
    id: "Arcade",
    name: lf("Arcade"),
    colors: [
        "#000000",
        "#FFFFFF",
        "#FF2121",
        "#FF93C4",
        "#FF8135",
        "#FFF609",
        "#249CA3",
        "#78DC52",
        "#003FAD",
        "#87F2FF",
        "#8E2EC4",
        "#A4839F",
        "#5C406c",
        "#E5CDC4",
        "#91463d",
        "#000000",
    ]
}


export const AllPalettes = [
    Arcade,
    Matte,
    Pastel,
    Sweet,
    Poke,
    Adventure,
    DIY,
    Adafruit,
    StillLife,
    SteamPunk,
    Grayscale,
]