namespace pxt.cloud {
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
            tooltip: lf("Saving project to the cloud..."),
            shortStatus: lf("saving..."),
            longStatus: lf("Saving to cloud..."),
            indicator: "*"
        },
    };
}
