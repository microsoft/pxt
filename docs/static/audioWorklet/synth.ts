interface Synth {
    osc: Oscillator;
    ampEnvelope: Envelope;
    pitchEnvelope: Envelope;
    gateOn: boolean;
    pitch: number; // this is in semitones from MIDI note 0
    pitchBend: number;
    pitchBendRange: number;
    ampLFO: LowFrequencyOscillator;
    pitchLFO: LowFrequencyOscillator;
}

function createDefaultSynth(): Synth {
    return {
        osc: createOscillator(SW_SINE),
        ampEnvelope: createEnvelope(10, 100, 0.5, 200, 1, Interpolation.Linear),
        pitchEnvelope: createEnvelope(10, 100, 0.5, 200, 0, Interpolation.Linear),
        gateOn: false,
        pitch: 60,
        pitchBend: 0,
        pitchBendRange: 2,
        ampLFO: createLFO(1, 0, LFOWave.Sine),
        pitchLFO: createLFO(1, 0, LFOWave.Sine)
    }
}

let debug: number[] = [];

function fillSamples(synth: Synth, output: Float32Array) {
    const basePitch = synth.pitch + synth.pitchBend * synth.pitchBendRange;
    for (let i = 0; i < output.length; ++i) {
        advanceEnvelope(synth.ampEnvelope, synth.gateOn);
        advanceEnvelope(synth.pitchEnvelope, synth.gateOn);
        advanceLFO(synth.ampLFO, synth.gateOn);
        advanceLFO(synth.pitchLFO, synth.gateOn);

        // if (synth.ampEnvelope.value) {
        //     debug.push(synth.ampEnvelope.value);
        // }
        // else {
        //     if (debug.length > 0) {
        //         console.log("Envelope debug: " + debug.join(", "));
        //         debug = [];
        //     }
        // }


        const pitch = basePitch + (
            synth.pitchEnvelope.amplitude * synth.pitchEnvelope.value +
            synth.pitchLFO.amplitude * synth.pitchLFO.value) * PITCH_MOD_RANGE;

        const amplitude = Math.max(synth.ampEnvelope.amplitude * synth.ampEnvelope.value - synth.ampLFO.amplitude * synth.ampLFO.value, 0);
        advanceOscillator(synth.osc, midiNoteToFrequency(pitch));
        output[i] = synth.osc.value * amplitude;
    }
}