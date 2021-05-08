namespace ts.pxtc {
    export function f4EncodeImg(w: number, h: number, bpp: number, getPix: (x: number, y: number) => number) {
        const header = [
            0x87, bpp,
            w & 0xff, w >> 8,
            h & 0xff, h >> 8,
            0, 0
        ]
        let r = header.map(hex2).join("")
        let ptr = 4
        let curr = 0
        let shift = 0

        let pushBits = (n: number) => {
            curr |= n << shift
            if (shift == 8 - bpp) {
                r += hex2(curr)
                ptr++
                curr = 0
                shift = 0
            } else {
                shift += bpp
            }
        }

        for (let i = 0; i < w; ++i) {
            for (let j = 0; j < h; ++j)
                pushBits(getPix(i, j))
            while (shift != 0)
                pushBits(0)
            if (bpp > 1) {
                while (ptr & 3)
                    pushBits(0)
            }
        }

        return r

        function hex2(n: number) {
            return ("0" + n.toString(16)).slice(-2)
        }
    }
}