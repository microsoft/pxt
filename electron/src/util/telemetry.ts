"use strict";

import * as I from "../typings/interfaces";

let pxtCore: I.PxtCore = null;
let pendingEvents: I.TelemetryEventInfo[] = [];

export function init(pxt: I.PxtCore): void {
    pxtCore = pxt;
    pendingEvents.forEach((e) => tickEvent(e.event, e.data));
    pendingEvents = [];
}

export function tickEvent(event: string, data?: I.Map<string | number>): void {
    const eventInfo: I.TelemetryEventInfo = {
        event,
        data
    };

    if (pxtCore) {
        pxtCore.sendElectronMessage({
            type: "telemetry",
            args: eventInfo
        } as I.ElectronMessage);
    } else {
        pendingEvents.push(eventInfo);
    }
}