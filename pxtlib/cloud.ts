namespace pxt.cloud {
    export type DevBackendType = "default" | "prod" | "staging" | "localhost";

    const DEV_BACKEND_PROD = "https://makecode.com";
    const DEV_BACKEND_STAGING = "https://staging.pxt.io";
    const DEV_BACKEND_LOCALHOST = "http://localhost:8080";

    type BackendUrls = typeof DEV_BACKEND_PROD | typeof DEV_BACKEND_STAGING | typeof DEV_BACKEND_LOCALHOST;
    export const DEV_BACKEND: BackendUrls = DEV_BACKEND_STAGING;

    export function devBackendType(): DevBackendType {
        if (DEV_BACKEND === DEV_BACKEND_PROD) return "prod";
        if (DEV_BACKEND === DEV_BACKEND_STAGING) return "staging";
        if (DEV_BACKEND === DEV_BACKEND_LOCALHOST) return "localhost";
        return "prod";
    }

    export type CloudStatus = "none" | "synced" | "justSynced" | "offline" | "syncing" | "conflict" | "localEdits";

    export type CloudStatusInfo = {
        value: pxt.cloud.CloudStatus,
        icon?: string,
        tooltip?: string,
        shortStatus?: string,
        longStatus?: string,
        indicator?: string
    };

    export const cloudStatus: { [index in pxt.cloud.CloudStatus]: CloudStatusInfo } = {
        "none": {
            value: "none",
        },
        "synced": {
            value: "synced",
            icon: "cloud-saved-b",
            tooltip: lf("Project saved to cloud"),
            shortStatus: lf("saved"),
            longStatus: lf("Saved to cloud"),
            indicator: "",
        },
        ["justSynced"]: {
            value: "justSynced",
            icon: "cloud-saved-b",
            tooltip: lf("Project saved to cloud"),
            shortStatus: lf("saved!"),
            longStatus: lf("Saved to cloud!"),
            indicator: "",
        },
        ["offline"]: {
            value: "offline",
            icon: "cloud-error-b",
            tooltip: lf("Unable to connect to cloud"),
            shortStatus: lf("offline"),
            longStatus: lf("Offline"),
            indicator: lf("offline"),
        },
        ["syncing"]: {
            value: "syncing",
            icon: "cloud-saving-b",
            tooltip: lf("Saving project to cloud..."),
            shortStatus: lf("saving..."),
            longStatus: lf("Saving to cloud..."),
            indicator: lf("syncing..."),
        },
        ["conflict"]: {
            value: "conflict",
            icon: "cloud-error-b",
            tooltip: lf("Project was edited in two places and the changes conflict"),
            shortStatus: lf("conflict!"),
            longStatus: lf("Project has a conflict!"),
            indicator: "!"
        },
        ["localEdits"]: {
            value: "localEdits",
            icon: "cloud-saving-b",
            tooltip: lf("Project has local changes and will save to cloud soon."),
            shortStatus: "",
            longStatus: "",
            indicator: "*"
        },
    };
}
