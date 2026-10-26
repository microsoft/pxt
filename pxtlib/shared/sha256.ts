/// <reference path="../commonutil.ts"/>

namespace ts.pxtc.BrowserImpl {
    function rotr(v: number, b: number) {
        return (v >>> b) | (v << (32 - b));
    }

    const sha256_k = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ])

    function sha256round(hs: Uint32Array, w: Uint32Array) {
        Util.assert(hs.length == 8);
        Util.assert(w.length == 64);

        for (let i = 16; i < 64; ++i) {
            let s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            let s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }

        let a = hs[0];
        let b = hs[1];
        let c = hs[2];
        let d = hs[3];
        let e = hs[4];
        let f = hs[5];
        let g = hs[6];
        let h = hs[7];

        for (let i = 0; i < 64; ++i) {
            let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            let ch = (e & f) ^ (~e & g)
            let temp1 = (h + s1 + ch + sha256_k[i] + w[i]) | 0
            let s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            let maj = (a & b) ^ (a & c) ^ (b & c)
            let temp2 = (s0 + maj) | 0

            h = g
            g = f
            f = e
            e = (d + temp1) | 0
            d = c
            c = b
            b = a
            a = (temp1 + temp2) | 0
        }

        hs[0] += a
        hs[1] += b
        hs[2] += c
        hs[3] += d
        hs[4] += e
        hs[5] += f
        hs[6] += g
        hs[7] += h
    }

    export function sha256buffer(buf: Uint8Array) {
        let h = new Uint32Array(8);
        h[0] = 0x6a09e667
        h[1] = 0xbb67ae85
        h[2] = 0x3c6ef372
        h[3] = 0xa54ff53a
        h[4] = 0x510e527f
        h[5] = 0x9b05688c
        h[6] = 0x1f83d9ab
        h[7] = 0x5be0cd19

        let work = new Uint32Array(64);

        let chunkLen = 16 * 4;

        function addBuf(buf: Uint8Array) {
            let end = buf.length - (chunkLen - 1)
            for (let i = 0; i < end; i += chunkLen) {
                for (let j = 0; j < 16; j++) {
                    let off = (j << 2) + i
                    work[j] = (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]
                }
                sha256round(h, work)
            }
        }

        addBuf(buf)

        let padSize = 64 - (buf.length + 9) % 64
        if (padSize == 64) padSize = 0
        let endPos = buf.length - (buf.length % chunkLen)
        let padBuf = new Uint8Array((buf.length - endPos) + 1 + padSize + 8)
        let dst = 0
        while (endPos < buf.length) padBuf[dst++] = buf[endPos++]
        padBuf[dst++] = 0x80
        while (padSize-- > 0)
            padBuf[dst++] = 0x00
        let len = buf.length * 8
        dst = padBuf.length
        while (len > 0) {
            padBuf[--dst] = len & 0xff
            len >>= 8
        }

        addBuf(padBuf)

        let res = ""
        for (let i = 0; i < h.length; ++i)
            res += ("000000000" + h[i].toString(16)).slice(-8)

        return res.toLowerCase()
    }
}
