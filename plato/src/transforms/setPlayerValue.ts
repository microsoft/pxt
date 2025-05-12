import * as collabClient from "@/services/collabClient";
import { ValueType } from "@/types";

export function setPlayerValue(clientId: string, key: string, val?: ValueType) {
    if (val === undefined) {
        collabClient.delClientValue(clientId, key);
    } else {
        collabClient.setClientValue(clientId, key, val);
    }
}
