namespace pxt {
    // Converts encoded JRES images into PNG data uris
    // this keeps a bit of state for perf reasons
    export class ImageConverter {
        private palette: Uint8Array
        private start: number

        logTime() {
            if (this.start) {
                let d = Date.now() - this.start
                pxt.debug("Icon creation: " + d + "ms")
            }
        }

        convert(jresURL: string): string {
            if (!this.start)
                this.start = Date.now()
            const data = atob(jresURL.slice(jresURL.indexOf(",") + 1))
            const magic = data.charCodeAt(0)
            const w = data.charCodeAt(1)
            const h = data.charCodeAt(2)
            if (magic != 0xe1 && magic != 0xe4)
                return null

            function htmlColorToBytes(hexColor: string) {
                const v = parseInt(hexColor.replace(/#/, ""), 16)
                return [(v >> 0) & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, 0xff]
            }


            if (!this.palette) {
                let arrs = pxt.appTarget.runtime.palette.map(htmlColorToBytes);

                // Set the alpha for transparency at index 0
                arrs[0][3] = 0;
                this.palette = new Uint8Array(arrs.length * 4)
                for (let i = 0; i < arrs.length; ++i) {
                    this.palette[i * 4 + 0] = arrs[i][0]
                    this.palette[i * 4 + 1] = arrs[i][1]
                    this.palette[i * 4 + 2] = arrs[i][2]
                    this.palette[i * 4 + 3] = arrs[i][3]
                }
            }

            if (magic == 0xe1) {
                return this.genMonochrome(data, w, h);
            }

            const scaleFactor = ((pxt.BrowserUtils.isEdge() || pxt.BrowserUtils.isIE()) && w < 100 && h < 100) ? 3 : 1;
            return this.genColor(data, w, h, scaleFactor);
        }

        genMonochrome(data: string, w: number, h: number) {
            let outByteW = (w + 3) & ~3

            let bmpHeaderSize = 14 + 40 + this.palette.length
            let bmpSize = bmpHeaderSize + outByteW * h
            let bmp = new Uint8Array(bmpSize)

            bmp[0] = 66
            bmp[1] = 77
            HF2.write32(bmp, 2, bmpSize)
            HF2.write32(bmp, 10, bmpHeaderSize)
            HF2.write32(bmp, 14, 40) // size of this header
            HF2.write32(bmp, 18, w)
            HF2.write32(bmp, 22, -h) // not upside down
            HF2.write16(bmp, 26, 1) // 1 color plane
            HF2.write16(bmp, 28, 8) // 8bpp
            HF2.write32(bmp, 38, 2835) // 72dpi
            HF2.write32(bmp, 42, 2835)
            HF2.write32(bmp, 46, this.palette.length >> 2)

            bmp.set(this.palette, 54)

            let inP = 4
            let outP = bmpHeaderSize
            let mask = 0x01
            let v = data.charCodeAt(inP++)
            for (let x = 0; x < w; ++x) {
                outP = bmpHeaderSize + x
                for (let y = 0; y < h; ++y) {
                    bmp[outP] = (v & mask) ? 1 : 0
                    outP += outByteW
                    mask <<= 1
                    if (mask == 0x100) {
                        mask = 0x01
                        v = data.charCodeAt(inP++)
                    }
                }
            }

            return "data:image/bmp;base64," + btoa(U.uint8ArrayToString(bmp))
        }

        genColor(data: string, width: number, height: number, intScale: number) {
            intScale = Math.max(1, intScale | 0);
            const w = width * intScale;
            const h = height * intScale;

            let outByteW = w << 2;
            let bmpHeaderSize = 138;
            let bmpSize = bmpHeaderSize + outByteW * h
            let bmp = new Uint8Array(bmpSize)

            bmp[0] = 66
            bmp[1] = 77
            HF2.write32(bmp, 2, bmpSize)
            HF2.write32(bmp, 10, bmpHeaderSize)
            HF2.write32(bmp, 14, 124) // size of this header
            HF2.write32(bmp, 18, w)
            HF2.write32(bmp, 22, -h) // not upside down
            HF2.write16(bmp, 26, 1) // 1 color plane
            HF2.write16(bmp, 28, 32) // 32bpp
            HF2.write16(bmp, 30, 3) // magic?
            HF2.write32(bmp, 38, 2835) // 72dpi
            HF2.write32(bmp, 42, 2835)

            HF2.write32(bmp, 54, 0xff0000) // Red bitmask
            HF2.write32(bmp, 58, 0xff00) // Green bitmask
            HF2.write32(bmp, 62, 0xff) // Blue bitmask
            HF2.write32(bmp, 66, 0xff000000) // Alpha bitmask

            // Color space (sRGB)
            bmp[70] = 0x42; // B
            bmp[71] = 0x47; // G
            bmp[72] = 0x52; // R
            bmp[73] = 0x73; // s

            let inP = 4
            let outP = bmpHeaderSize

            for (let x = 0; x < w; x++) {
                let high = false;
                outP = bmpHeaderSize + (x << 2)
                let columnStart = inP;

                let v = data.charCodeAt(inP++);
                let colorStart = high ? (((v >> 4) & 0xf) << 2) : ((v & 0xf) << 2);

                for (let y = 0; y < h; y ++) {
                    bmp[outP] = this.palette[colorStart]
                    bmp[outP + 1] = this.palette[colorStart + 1]
                    bmp[outP + 2] = this.palette[colorStart + 2]
                    bmp[outP + 3] = this.palette[colorStart + 3]
                    outP += outByteW

                    if (y % intScale === intScale - 1) {
                        if (high) {
                            v = data.charCodeAt(inP++);
                        }
                        high = !high;

                        colorStart = high ? (((v >> 4) & 0xf) << 2) : ((v & 0xf) << 2);
                    }
                }

                if (x % intScale === intScale - 1)  {
                    if (!(height % 2)) --inP;
                    while (inP & 3) inP++
                }
                else {
                    inP = columnStart;
                }
            }

            return "data:image/bmp;base64," + btoa(U.uint8ArrayToString(bmp))
        }
    }
}