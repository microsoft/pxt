import { nanoid } from "nanoid";
import { NotificationWithId } from "../types";

export function makeNotification(
    message: string,
    duration: number
): NotificationWithId {
    return {
        id: nanoid(),
        message,
        duration,
        expiration: Date.now() + duration,
    };
}