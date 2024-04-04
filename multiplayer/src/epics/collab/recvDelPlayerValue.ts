import { getCollabCanvas } from "../../services/collabCanvas";
import * as collabClient from "../../services/collabClient";

export function recvDelPlayerValue(key: string, senderId: string) {
    if (senderId === collabClient.getClientId()) return;
}
