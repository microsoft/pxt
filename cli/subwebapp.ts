import config = require("./webapps-config.json");

export interface SubWebAppConfig {
    name: string;
    buildCss: boolean;

    // If true, the local server will seve the "--" endpoint defined in the web config (e.g. /--skilmap)
    localServeWebConfigUrl: boolean;

    // If defined, the local serve will serve the webapp code at this endpoint (e.g. /eva;)
    localServeEndpoint?: string;
}

export const SUB_WEBAPPS: SubWebAppConfig[] = config.webapps;