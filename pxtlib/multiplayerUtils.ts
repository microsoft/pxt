namespace pxt.multiplayer {
    enum MultiplayerDevBackendType {
        PROD,
        STAGING,
        LOCAL
    }
    let MULTIPLAYER_DEV_BACKEND_TYPE = MultiplayerDevBackendType.STAGING;

    export const SHORT_LINKS = {
        PROD: "https://aka.ms/a9",
        PROD_BETA: "https://aka.ms/a9b",
        STAGING: "https://aka.ms/a9s",
        STAGING_BETA: "https://aka.ms/a9sb",
        LOCAL: "http://localhost:3000"
    };

    export const SHORT_LINK = () => {
        if (pxt.BrowserUtils.isLocalHostDev()) {
            switch (MULTIPLAYER_DEV_BACKEND_TYPE) {
                case MultiplayerDevBackendType.PROD:
                    return SHORT_LINKS.PROD_BETA;
                case MultiplayerDevBackendType.STAGING:
                    return SHORT_LINKS.STAGING_BETA;
                case MultiplayerDevBackendType.LOCAL:
                    return SHORT_LINKS.LOCAL;
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

    export function makeHostLink(shareUrlOrCode: string) {
        return `${SHORT_LINK()}?host=${encodeURIComponent(shareUrlOrCode)}`;
    }

    export function makeJoinLink(joinCode: string) {
        return `${SHORT_LINK()}?join=${encodeURIComponent(joinCode)}`;
    }
}
