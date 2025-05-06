import * as collabClient from "@/services/collabClient";
import { generateRandomName } from "@/utils";

export async function joinedSessionAsync(role: string, clientId: string) {
    collabClient.setName(generateRandomName());
}
