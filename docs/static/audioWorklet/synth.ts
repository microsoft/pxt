interface Synth {
    osc: Oscillator;
    ampEnvelope: Envelope;
    pitchEnvelope: Envelope;
    gateOn: boolean;
    frequency: number;
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
        frequency: 440,
        pitchBend: 0,
        pitchBendRange: 1200,
        ampLFO: createLFO(1, 0, LFOWave.Sine),
        pitchLFO: createLFO(1, 0, LFOWave.Sine)
    }
}

let debug: number[] = [];

function fillSamples(synth: Synth, output: Float32Array) {
    const baseFrequency = synth.frequency + synth.pitchBend * synth.pitchBendRange / 1204;
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

        const pitchEnvelopeRange = 1024

        const frequency = baseFrequency + synth.pitchEnvelope.amplitude * synth.pitchEnvelope.value * pitchEnvelopeRange + synth.pitchLFO.amplitude * synth.pitchLFO.value * pitchEnvelopeRange;
        const amplitude = Math.max(synth.ampEnvelope.amplitude * synth.ampEnvelope.value - synth.ampLFO.amplitude * synth.ampLFO.value, 0);
        advanceOscillator(synth.osc, frequency);
        output[i] = synth.osc.value * amplitude;
    }
}