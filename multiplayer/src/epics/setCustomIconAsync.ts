import { IconType } from "../types";

import { dispatch } from "../state";
import { setPresenceIconOverride, setReactionIconOverride } from "../state/actions";

export async function setCustomIconAsync(iconType: IconType, slot: number, pngDataUri?: string) {
    try {
        const actionHandler = iconType === IconType.Player ? setPresenceIconOverride : setReactionIconOverride;
        dispatch(actionHandler(slot, pngDataUri));
    } catch (e) {
    } finally {
    }
}
