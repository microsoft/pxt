namespace pxt.multiplayer {
    export const SHORT_LINKS = {
        PROD: "https://aka.ms/a9",
        PROD_BETA: "https://aka.ms/a9b",
        STAGING: "https://aka.ms/a9s",
        STAGING_BETA: "https://aka.ms/a9sb",
        LOCAL: "http://localhost:3000"
    };

    export const SHORT_LINK = () => {
        if (pxt.BrowserUtils.isLocalHostDev()) {
            switch (pxt.cloud.devBackendType()) {
                case "prod":
                    return SHORT_LINKS.PROD;
                case "staging":
                    return SHORT_LINKS.STAGING;
                case "localhost":
                    return SHORT_LINKS.LOCAL;
            }
        }

        if (window.location.hostname.includes(".makecode.com")) {
            if (window.location.pathname.startsWith("/beta")) {
                return SHORT_LINKS.PROD_BETA;
            } else {
                return SHORT_LINKS.PROD;
            }
        }

        if (window.location.pathname.startsWith("/beta")) {
            return SHORT_LINKS.STAGING_BETA;
        } else {
            return SHORT_LINKS.STAGING;
        }
    };

    export function makeHostLink(shareUrlOrCode: string) {
        return `${SHORT_LINK()}?host=${encodeURIComponent(shareUrlOrCode)}`;
    }

    export function makeJoinLink(joinCode: string) {
        return `${SHORT_LINK()}?join=${encodeURIComponent(joinCode)}`;
    }
}
