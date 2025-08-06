import config = require("./webapps-config.json");

export interface SubWebAppConfig {
    name: string;
    buildCss: boolean;

    // If true, the local server will serve the "--" endpoint defined in the web config (e.g. /--skillmap)
    localServeWebConfigUrl: boolean;

    // If defined, the local server will serve the webapp code at this endpoint (e.g. /eval)
    localServeEndpoint?: string;
}

export const SUB_WEBAPPS: SubWebAppConfig[] = config.webapps;