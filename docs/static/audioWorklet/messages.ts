
const enum ComponentIndex {
    Gate = 0,
    Oscillator = 1,
    Frequency = 2,
    AmpEnvelope = 3,
    PitchEnvelope = 4,
    AmpLFO = 5,
    PitchLFO = 6,
    PitchBend = 7,
}

const enum OscillatorParamIndex {
    Wave = 0
}

const enum EnvelopeParamIndex {
    Attack = 0,
    Decay = 1,
    Sustain = 2,
    Release = 3,
    Amplitude = 4,
    Interpolation = 5
}

const enum LFOParamIndex {
    Frequency = 0,
    Wave = 1,
    Amplitude = 2
}

const enum PitchBendParamIndex {
    Value = 0,
    Range = 1
}

function handleMessage(synth: Synth, message: [number, number, number]) {
    const component = message[0];
    const param = message[1];
    const value = message[2];

    switch (component) {
        case ComponentIndex.Gate:
            const on = !!value;
            if (synth.gateOn !== on) {
                synth.gateOn = on;
            }
            else if (on && synth.gateOn) {
                // retrigger the gate
                synth.ampEnvelope.stage = EnvelopeStage.Idle;
                synth.pitchEnvelope.stage = EnvelopeStage.Idle;
                synth.ampEnvelope.samplesLeft = 0;
                synth.pitchEnvelope.samplesLeft = 0;
            }
            break;
        case ComponentIndex.Oscillator:
            if (param === OscillatorParamIndex.Wave) {
                synth.osc.wave = value;
                synth.osc.waveFn = getWaveFn(value);
            }
            break;
        case ComponentIndex.Frequency:
            synth.pitch = value / 0x7fff * MAX_NOTE; // scale to MIDI note range
            break;
        case ComponentIndex.AmpEnvelope:
            setEnvelopeParam(synth.ampEnvelope, param, value);
            break;
        case ComponentIndex.PitchEnvelope:
            setEnvelopeParam(synth.pitchEnvelope, param, value);
            break;
        case ComponentIndex.AmpLFO:
            setLFOParam(synth.ampLFO, param, value);
            break;
        case ComponentIndex.PitchLFO:
            setLFOParam(synth.pitchLFO, param, value);
            break;
        case ComponentIndex.PitchBend:
            if (param === PitchBendParamIndex.Value) {
                synth.pitchBend = value / 0x7fff;
            } else if (param === PitchBendParamIndex.Range) {
                synth.pitchBendRange = value / 0x7fff * PITCH_MOD_RANGE;
            }
            break;
    }
}