namespace pxt.AudioContextManager {
    let _frequency = 0;
    let _context: AudioContext; // AudioContext
    let _vco: OscillatorNode; // OscillatorNode;
    let _gain: GainNode;

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

        if (mute && _vco) {
            _vco.disconnect();
            _gain.disconnect();
            _vco = undefined;
            _gain = undefined;
        }
    }

    export function stop() {
        if (!_context)
            return;

        _gain.gain.setTargetAtTime(0, _context.currentTime, 0.015);
        _frequency = 0;
    }

    export function frequency(): number {
        return _frequency;
    }

    export function tone(frequency: number) {
        if (_mute) return;
        if (frequency <= 0) return;
        _frequency = frequency;

        let ctx = context() as AudioContext;
        if (!ctx) return;

        try {
            if (!_vco) {
                _vco = ctx.createOscillator();
                _vco.type = 'triangle';

                _gain = ctx.createGain();
                _gain.connect(ctx.destination);

                _vco.connect(_gain);
                _vco.start(0);

            }
            _vco.frequency.value = frequency;
            _gain.gain.setTargetAtTime(1, _context.currentTime, 0.015);

        } catch (e) {
            _vco = undefined;
            return;
        }
    }
}