namespace pxt.multiplayer {
    export type ServiceType = "multiplayer" | "plato";
    enum MultiplayerDevBackendType {
        PROD,
        STAGING,
        LOCAL
    }
    let MULTIPLAYER_DEV_BACKEND_TYPE = MultiplayerDevBackendType.STAGING as any;

    export const ABSOLUTE_LINKS = {
        PROD_BETA: "https://arcade.makecode.com/beta--multiplayer",
        PROD_BETA_PLATO: "https://arcade.makecode.com/beta--plato",
        STAGING_BETA: "https://arcade.staging.pxt.io/beta--multiplayer",
        STAGING_BETA_PLATO: "https://arcade.staging.pxt.io/beta--plato",
        LOCAL: "http://localhost:3000",
    };

    export const RELATIVE_LINKS = {
        PROD: "/--multiplayer",
        PROD_PLATO: "/--plato",
        BETA: "/beta--multiplayer",
        BETA_PLATO: "/beta--plato",
    };

    export const SHORT_LINKS = {
        PROD: "https://aka.ms/a9",
        PROD_PLATO: "https://aka.ms/a9plato",
        PROD_BETA: "https://aka.ms/a9b",
        PROD_BETA_PLATO: "https://aka.ms/a9bplato",
        STAGING: "https://aka.ms/a9s",
        STAGING_PLATO: "https://aka.ms/a9splato",
        STAGING_BETA: "https://aka.ms/a9sb",
        STAGING_BETA_PLATO: "https://aka.ms/a9sbplato",
    };

    export const RELATIVE_LINK = (serviceType: ServiceType) => {
        switch (serviceType) {
            case "plato": {
                if (pxt.BrowserUtils.isLocalHostDev()) {
                    switch (MULTIPLAYER_DEV_BACKEND_TYPE) {
                        case MultiplayerDevBackendType.PROD:
                            return ABSOLUTE_LINKS.PROD_BETA_PLATO;
                        case MultiplayerDevBackendType.STAGING:
                            return ABSOLUTE_LINKS.STAGING_BETA_PLATO;
                        case MultiplayerDevBackendType.LOCAL:
                            return ABSOLUTE_LINKS.LOCAL;
                    }
                }
                if (window.location.pathname.startsWith("/beta")) {
                    return RELATIVE_LINKS.BETA_PLATO;
                } else {
                    return RELATIVE_LINKS.PROD_PLATO;
                }
            }
            case "multiplayer": {
                if (pxt.BrowserUtils.isLocalHostDev()) {

                    switch (MULTIPLAYER_DEV_BACKEND_TYPE) {
                        case MultiplayerDevBackendType.PROD:
                            return ABSOLUTE_LINKS.PROD_BETA;
                        case MultiplayerDevBackendType.STAGING:
                            return ABSOLUTE_LINKS.STAGING_BETA;
                        case MultiplayerDevBackendType.LOCAL:
                            return ABSOLUTE_LINKS.LOCAL;
                    }
                }

                if (window.location.pathname.startsWith("/beta")) {
                    return RELATIVE_LINKS.BETA;
                } else {
                    return RELATIVE_LINKS.PROD;
                }
            }
        }
    };

    export const SHORT_LINK = (serviceType: ServiceType) => {
        switch (serviceType) {
            case "plato": {
                if (pxt.BrowserUtils.isLocalHostDev()) {
                    switch (MULTIPLAYER_DEV_BACKEND_TYPE) {
                        case MultiplayerDevBackendType.PROD:
                            return SHORT_LINKS.PROD_BETA_PLATO;
                        case MultiplayerDevBackendType.STAGING:
                            return SHORT_LINKS.STAGING_BETA_PLATO;
                        case MultiplayerDevBackendType.LOCAL:
                            return ABSOLUTE_LINKS.LOCAL;
                    }
                }

                if (window.location.host.endsWith(".staging.pxt.io")) {
                    if (window.location.pathname.startsWith("/beta")) {
                        return SHORT_LINKS.STAGING_BETA_PLATO;
                    } else {
                        return SHORT_LINKS.STAGING_PLATO;
                    }
                }

                if (window.location.pathname.startsWith("/beta")) {
                    return SHORT_LINKS.PROD_BETA_PLATO;
                } else {
                    return SHORT_LINKS.PROD_PLATO;
                }
            }
            case "multiplayer": {
                if (pxt.BrowserUtils.isLocalHostDev()) {
                    switch (MULTIPLAYER_DEV_BACKEND_TYPE) {
                        case MultiplayerDevBackendType.PROD:
                            return SHORT_LINKS.PROD_BETA;
                        case MultiplayerDevBackendType.STAGING:
                            return SHORT_LINKS.STAGING_BETA;
                        case MultiplayerDevBackendType.LOCAL:
                            return ABSOLUTE_LINKS.LOCAL;
                    }
                }

                if (window.location.host.endsWith(".staging.pxt.io")) {
                    if (window.location.pathname.startsWith("/beta")) {
                        return SHORT_LINKS.STAGING_BETA;
                    } else {
                        return SHORT_LINKS.STAGING;
                    }
                }

                if (window.location.pathname.startsWith("/beta")) {
                    return SHORT_LINKS.PROD_BETA;
                } else {
                    return SHORT_LINKS.PROD;
                }
            }
        }
    };

    export function makeHostLink(serviceType: ServiceType, shareUrlOrCode: string, shortLink: boolean) {
        return `${shortLink ? SHORT_LINK(serviceType) : RELATIVE_LINK(serviceType)}?host=${encodeURIComponent(shareUrlOrCode)}`;
    }

    export function makeJoinLink(serviceType: ServiceType, joinCode: string, shortLink: boolean) {
        return `${shortLink ? SHORT_LINK(serviceType) : RELATIVE_LINK(serviceType)}?join=${encodeURIComponent(joinCode)}`;
    }
}
