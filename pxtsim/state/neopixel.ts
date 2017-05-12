
namespace pxsim {
    export enum NeoPixelMode { RGB, RGBW };
    export type RGBW = [number, number, number, number];

    export class NeoPixelState {
        private buffers: Map<Uint8Array> = {};
        private colors: Map<RGBW[]> = {};
        private dirty: Map<boolean> = {};

        public updateBuffer(buffer: Uint8Array, pin: number) {
            this.buffers[pin] = buffer;
            this.dirty[pin] = true;
        }

        public getColors(pin: number, mode: NeoPixelMode): RGBW[] {
            let outColors = this.colors[pin] || (this.colors[pin] = []);
            if (this.dirty[pin]) {
                let buf = this.buffers[pin] || (this.buffers[pin] = new Uint8Array([]));
                this.readNeoPixelBuffer(buf, outColors, mode);
                this.dirty[pin] = false;
            }
            return outColors;
        }


        private readNeoPixelBuffer(inBuffer: Uint8Array, outColors: RGBW[], mode: NeoPixelMode) {
            let buf = inBuffer;
            let stride = mode === NeoPixelMode.RGBW ? 4 : 3;
            let pixelCount = Math.floor(buf.length / stride);
            for (let i = 0; i < pixelCount; i++) {
                // NOTE: for whatever reason, NeoPixels pack GRB not RGB
                let r = buf[i * stride + 1]
                let g = buf[i * stride + 0]
                let b = buf[i * stride + 2]
                let w = 0;
                if (stride === 4)
                    w = buf[i * stride + 3]
                outColors[i] = [r, g, b, w]
            }

        }
    }
}
