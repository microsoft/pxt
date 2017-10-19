
namespace pxtblockly {
    export namespace svg {
        export function hasClass(el: SVGElement, cls: string): boolean {
            if (el.classList) return el.classList.contains(cls);
            else return el.className.baseVal.indexOf(cls) > -1;
        }

        export function addClass(el: SVGElement, cls: string) {
            if (el.classList) el.classList.add(cls);
            else if (el.className.baseVal.indexOf(cls) < 0) el.className.baseVal += ' ' + cls;
        }

        export function removeClass(el: SVGElement, cls: string) {
            if (el.classList) el.classList.remove(cls);
            else el.className.baseVal = el.className.baseVal.replace(cls, '').replace(/\s{2,}/, ' ');
        }
    }

    export function parseColour(colour: string | number): string {
        const hue = Number(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        } else if (goog.isString(colour) && (colour as string).match(/^#[0-9a-fA-F]{6}$/)) {
            return colour as string;
        } else {
            return '#000';
        }
    }

    export namespace AudioContextManager {
        let _frequency = 0;
        let _context: any; // AudioContext
        let _vco: any; // OscillatorNode;

        let _mute = false; //mute audio

        function context(): any {
            if (!_context) _context = freshContext();
            return _context;
        }

        function freshContext(): any {
            (<any>window).AudioContext = (<any>window).AudioContext || (<any>window).webkitAudioContext;
            if ((<any>window).AudioContext) {
                try {
                    // this call my crash.
                    // SyntaxError: audio resources unavailable for AudioContext construction
                    return new (<any>window).AudioContext();
                } catch (e) { }
            }
            return undefined;
        }

        export function mute(mute: boolean) {
            if (!_context)
                return;
            _mute = mute;
            stop();
        }

        export function stop() {
            if (!_context)
                return;
            _vco.disconnect();
            _frequency = 0;
        }

        export function frequency(): number {
            return _frequency;
        }

        export function tone(frequency: number) {
            if (_mute) return;
            if (frequency <= 0) return;
            _frequency = frequency;

            let ctx = context();
            if (!ctx) return;

            try {
                if (_vco) {
                    _vco.disconnect();
                    _vco = undefined;
                }
                _vco = ctx.createOscillator();
                _vco.frequency.value = frequency;
                _vco.type = 'triangle';
                _vco.connect(ctx.destination);

                _vco.start(0);
            } catch (e) {
                _vco = undefined;
                return;
            }

        }
    }
}