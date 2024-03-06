export interface SubWebAppConfig {
    name: string;
    buildCss: boolean;

    // If true, the local server will seve the "--" endpoint defined in the web config (e.g. /--skilmap)
    localServeWebConfigUrl: boolean;

    // If defined, the local serve will serve the webapp code at this endpoint (e.g. /eva;)
    localServeEndpoint?: string;
}

// All of our various create react apps
export const SUB_WEBAPPS: SubWebAppConfig[]= [
    {
        name: "kiosk",
        buildCss: false,
        localServeWebConfigUrl: false,
        localServeEndpoint: "kiosk"
    },
    {
        name: "teachertool",
        buildCss: false,
        localServeWebConfigUrl: false,
        localServeEndpoint: "eval"
    },
    {
        name: "skillmap",
        buildCss: true,
        localServeWebConfigUrl: true
    },
    {
        name: "multiplayer",
        buildCss: true,
        localServeWebConfigUrl: true,
        localServeEndpoint: "multiplayer"
    },
    {
        name: "authcode",
        buildCss: true,
        localServeWebConfigUrl: true
    },
];