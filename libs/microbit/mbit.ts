type Action = () => void;

namespace helpers {
    export function arraySplice<T>(arr: T[], start: number, len: number) {
        if (start < 0) {
            return;
        }
        for (let i = 0; i < len; ++i) {
            arr.removeAt(start)
        }
    }
}

namespace console {
    export function log(msg: string) {
        writeString(msg);
        writeString("\r\n");
    }
    
    //% shim=micro_bit::serialSendString
    function writeString(text: string): void { }
}

namespace math {
    export function clamp(min: number, max:number, value:number): number {
        return Math.min(max, Math.max(min, value));
    }
}
