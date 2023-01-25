namespace pxt.multiplayer {
    enum MultiplayerDevBackendType {
        PROD,
        STAGING,
        LOCAL
    }
    let MULTIPLAYER_DEV_BACKEND_TYPE = MultiplayerDevBackendType.STAGING;

    export const ABSOLUTE_LINKS = {
        PROD_BETA: "https://arcade.makecode.com/beta--multiplayer",
        STAGING_BETA: "https://arcade.staging.pxt.io/beta--multiplayer",
        LOCAL: "http://localhost:3000",
    };

    export const RELATIVE_LINKS = {
        PROD: "/--multiplayer",
        BETA: "/beta--multiplayer",
    };

    export const SHORT_LINKS = {
        PROD: "https://aka.ms/a9",
        PROD_BETA: "https://aka.ms/a9b",
        STAGING: "https://aka.ms/a9s",
        STAGING_BETA: "https://aka.ms/a9sb",
    };

    export const RELATIVE_LINK = () => {
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
    };

    export const SHORT_LINK = () => {
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
    };

    export function makeHostLink(shareUrlOrCode: string, shortLink: boolean) {
        return `${shortLink ? SHORT_LINK() : RELATIVE_LINK()}?host=${encodeURIComponent(shareUrlOrCode)}`;
    }

    export function makeJoinLink(joinCode: string, shortLink: boolean) {
        return `${shortLink ? SHORT_LINK() : RELATIVE_LINK()}?join=${encodeURIComponent(joinCode)}`;
    }
}
