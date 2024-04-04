import { getCollabCanvas } from "../../services/collabCanvas";

export function recvSetSessionState(sessKv: Map<string, string>) {
    sessKv.forEach((value, key) => {
        if (key.startsWith("s:")) {
            const sprite = JSON.parse(value);
            getCollabCanvas().addPaintSprite(key, sprite.x, sprite.y, sprite.s, sprite.c, sprite.a);
        }
    });
}
