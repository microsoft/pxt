import * as React from "react";

export interface VersionHistoryModal {
    history: pxt.workspace.HistoryEntry[];
    getVersionAtTimestamp(time: number): pxt.Map<string>;
    onTimestampSelected(time: number): void;
}