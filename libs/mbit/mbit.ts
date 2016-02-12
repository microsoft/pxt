type Action = () => void;

namespace helpers {
    export function arraySplice<T>(arr: T[], start: number, len: number) {
        if (start < 0) return;
        for (let i = 0; i < len; ++i)
            arr.removeAt(start)
    }
}

namespace console {
    export function log(msg: string) {
        serial.writeLine(msg);
    }
}


interface Image {
    /**
     * Shows an frame from the image at offset ``x offset``.
     * @param xOffset TODO
     */
    //% help=functions/show-image weight=69 shim=micro_bit::showImage
    showImage(xOffset: number) : void;
}
