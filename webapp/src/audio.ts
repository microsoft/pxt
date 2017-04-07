let _context: AudioContext; // AudioContext

function context(): AudioContext {
    if (!_context) _context = freshContext();
    return _context;
}

function freshContext(): AudioContext {
    (<any>window).AudioContext = (<any>window).AudioContext || (<any>window).webkitAudioContext;
    if ((<any>window).AudioContext) {
        try {
            // this call might crash.
            // SyntaxError: audio resources unavailable for AudioContext construction
            return new (<any>window).AudioContext();
        } catch (e) { }
    }
    return undefined;
}

export function play(buffer: AudioBuffer, volume: number = 1) {
    if (!buffer) return;

    const ctx = context();
    if (!ctx) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
}

export function loadAsync(buffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = context();
    return new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(buffer,
            (b: AudioBuffer) => resolve(b),
            () => { resolve(undefined) }
        );
    });
}
