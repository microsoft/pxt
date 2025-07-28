"use strict";
function advanceEnvelope(envelope, gateOn) {
    if (envelope.amplitude === 0) {
        return;
    }
    if (gateOn) {
        if (envelope.stage === 4 /* EnvelopeStage.Idle */ || envelope.stage === 3 /* EnvelopeStage.Release */) {
            envelope.samplesLeft = envelope.attack;
            envelope.stage = 0 /* EnvelopeStage.Attack */;
            envelope.stageStartValue = envelope.value;
        }
        else if (envelope.stage === 0 /* EnvelopeStage.Attack */) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = envelope.stageStartValue + envelope.interpolation(1 - envelope.samplesLeft / envelope.attack);
                if (envelope.value > 1) {
                    envelope.value = 1;
                    envelope.stage = 1 /* EnvelopeStage.Decay */;
                    envelope.samplesLeft = envelope.decay;
                }
            }
            else {
                envelope.samplesLeft = envelope.decay;
                envelope.stage = 1 /* EnvelopeStage.Decay */;
                envelope.value = 1;
            }
        }
        else if (envelope.stage === 1 /* EnvelopeStage.Decay */) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = 1 - envelope.interpolation(1 - envelope.samplesLeft / envelope.decay) * (1 - envelope.sustain);
                if (envelope.value < envelope.sustain) {
                    envelope.value = envelope.sustain;
                    envelope.stage = 2 /* EnvelopeStage.Sustain */;
                }
            }
            else {
                envelope.stage = 2 /* EnvelopeStage.Sustain */;
                envelope.value = envelope.sustain;
            }
        }
    }
    else {
        if (envelope.stage === 3 /* EnvelopeStage.Release */) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = envelope.stageStartValue - envelope.interpolation(1 - envelope.samplesLeft / envelope.release) * envelope.stageStartValue;
                if (envelope.value < 0) {
                    envelope.value = 0;
                    envelope.stage = 4 /* EnvelopeStage.Idle */;
                }
            }
            else {
                envelope.stage = 4 /* EnvelopeStage.Idle */;
                envelope.samplesLeft = 0;
            }
        }
        else if (envelope.stage !== 4 /* EnvelopeStage.Idle */) {
            envelope.stage = 3 /* EnvelopeStage.Release */;
            envelope.samplesLeft = envelope.release;
            envelope.stageStartValue = envelope.value;
        }
    }
}
function setEnvelopeParam(envelope, param, value) {
    switch (param) {
        case 0 /* EnvelopeParamIndex.Attack */:
            envelope.attack = millisToSamples(value);
            break;
        case 1 /* EnvelopeParamIndex.Decay */:
            envelope.decay = millisToSamples(value);
            break;
        case 2 /* EnvelopeParamIndex.Sustain */:
            envelope.sustain = value / 0x7fff;
            break;
        case 3 /* EnvelopeParamIndex.Release */:
            envelope.release = millisToSamples(value);
            break;
        case 4 /* EnvelopeParamIndex.Amplitude */:
            envelope.amplitude = value / 0x7fff;
            break;
        case 5 /* EnvelopeParamIndex.Interpolation */:
            envelope.interpolation = interpolationFunction(value);
            break;
        default:
            throw new Error("Unknown envelope parameter");
    }
}
function createEnvelope(attack, decay, sustain, release, amplitude, interpolation) {
    return {
        attack: millisToSamples(attack),
        decay: millisToSamples(decay),
        sustain,
        release: millisToSamples(release),
        amplitude,
        samplesLeft: 0,
        value: 0,
        stageStartValue: 0,
        stage: 4 /* EnvelopeStage.Idle */,
        interpolation: interpolationFunction(interpolation)
    };
}
function interpolationValue(interpolation, value) {
    switch (interpolation) {
        case 0 /* Interpolation.Linear */:
            return linearInterpolation(value);
        case 1 /* Interpolation.Logarithmic */:
            return logarithmicInterpolation(value);
        case 2 /* Interpolation.Exponential */:
            return exponentialInterpolation(value);
        default:
            throw new Error("Unknown interpolation type");
    }
}
function interpolationFunction(interpolation) {
    switch (interpolation) {
        case 0 /* Interpolation.Linear */:
            return linearInterpolation;
        case 1 /* Interpolation.Logarithmic */:
            return logarithmicInterpolation;
        case 2 /* Interpolation.Exponential */:
            return exponentialInterpolation;
        default:
            throw new Error("Unknown interpolation type");
    }
}
function linearInterpolation(value) {
    return value;
}
function exponentialInterpolation(value) {
    return 1 - Math.log(1 + (1 - value) * 1.718281828459045);
}
function logarithmicInterpolation(value) {
    return Math.log(1 + value * 1.718281828459045);
}
function advanceLFO(lfo, gateOn) {
    if (lfo.amplitude <= 0) {
        return;
    }
    if (gateOn) {
        // reset lfo on gate start
        if (!lfo.triggered) {
            lfo.samplesLeft = 0;
            lfo.triggered = true;
        }
    }
    else {
        lfo.triggered = false;
    }
    if (lfo.samplesLeft <= 0) {
        lfo.samplesLeft = lfo.period;
        lfo.value = lfo.wave(lfo, 0);
    }
    else {
        lfo.samplesLeft--;
        lfo.value = lfo.wave(lfo, (lfo.period - lfo.samplesLeft) / lfo.period);
    }
}
function createLFO(frequency, amplitude, wave) {
    const lfo = {
        period: millisToSamples(1000 / frequency),
        samplesLeft: 0,
        value: 0,
        amplitude: amplitude,
        triggered: false,
        wave: getLFOWaveFunction(wave)
    };
    return lfo;
}
function getLFOWaveFunction(wave) {
    switch (wave) {
        case 0 /* LFOWave.Sine */:
            return lfoSineWave;
        case 1 /* LFOWave.Triangle */:
            return lfoTriangleWave;
        case 2 /* LFOWave.Square */:
            return lfoSquareWave;
        case 3 /* LFOWave.Ramp */:
            return lfoRampWave;
        case 4 /* LFOWave.Sawtooth */:
            return lfoSawtoothWave;
        case 5 /* LFOWave.Random */:
            return lfoRandomWave;
        default:
            throw new Error("Unknown LFO wave type");
    }
}
function lfoSineWave(lfo, progress) {
    return (1 + Math.sin(progress * Math.PI * 2)) / 2;
}
function lfoTriangleWave(lfo, progress) {
    return 1 - Math.abs(2 * progress - 1);
}
function lfoSquareWave(lfo, progress) {
    return progress < 0.5 ? 0 : 1;
}
function lfoRampWave(lfo, progress) {
    return progress;
}
function lfoSawtoothWave(lfo, progress) {
    return 1 - progress;
}
function lfoRandomWave(lfo, progress) {
    if (progress === 0) {
        return Math.random();
    }
    return lfo.value; // sample and hold
}
function setLFOParam(lfo, param, value) {
    switch (param) {
        case 0 /* LFOParamIndex.Frequency */:
            lfo.period = millisToSamples(1000 / value);
            break;
        case 1 /* LFOParamIndex.Wave */:
            lfo.wave = getLFOWaveFunction(value);
            break;
        case 2 /* LFOParamIndex.Amplitude */:
            lfo.amplitude = value / 0x7fff;
            break;
        default:
            throw new Error("Unknown LFO parameter");
    }
}
function handleMessage(synth, message) {
    const component = message[0];
    const param = message[1];
    const value = message[2];
    switch (component) {
        case 0 /* ComponentIndex.Gate */:
            const on = !!value;
            if (synth.gateOn !== on) {
                synth.gateOn = on;
            }
            else if (on && synth.gateOn) {
                // retrigger the gate
                synth.ampEnvelope.stage = 4 /* EnvelopeStage.Idle */;
                synth.pitchEnvelope.stage = 4 /* EnvelopeStage.Idle */;
                synth.ampEnvelope.samplesLeft = 0;
                synth.pitchEnvelope.samplesLeft = 0;
            }
            break;
        case 1 /* ComponentIndex.Oscillator */:
            if (param === 0 /* OscillatorParamIndex.Wave */) {
                synth.osc.wave = value;
                synth.osc.waveFn = getWaveFn(value);
            }
            break;
        case 2 /* ComponentIndex.Frequency */:
            synth.frequency = value;
            break;
        case 3 /* ComponentIndex.AmpEnvelope */:
            setEnvelopeParam(synth.ampEnvelope, param, value);
            break;
        case 4 /* ComponentIndex.PitchEnvelope */:
            setEnvelopeParam(synth.pitchEnvelope, param, value);
            break;
        case 5 /* ComponentIndex.AmpLFO */:
            setLFOParam(synth.ampLFO, param, value);
            break;
        case 6 /* ComponentIndex.PitchLFO */:
            setLFOParam(synth.pitchLFO, param, value);
            break;
        case 7 /* ComponentIndex.PitchBend */:
            if (param === 0 /* PitchBendParamIndex.Value */) {
                synth.pitchBend = value;
            }
            else if (param === 1 /* PitchBendParamIndex.Range */) {
                synth.pitchBendRange = value;
            }
            break;
    }
}
const samplesPerMS = (sampleRate << 8) / 1000;
const toneStepMult = (1024.0 * (1 << 16)) / sampleRate;
function advanceOscillator(osc, frequency) {
    const toneStep = Math.floor(frequency * toneStepMult);
    osc.position += toneStep;
    osc.value = osc.waveFn(osc, (osc.position >> 16) & 1023, osc.position >> 26) / 0x7fff;
}
const SW_TRIANGLE = 1;
const SW_SAWTOOTH = 2;
const SW_SINE = 3;
const SW_TUNEDNOISE = 4;
const SW_NOISE = 5;
const SW_SQUARE_10 = 11;
const SW_SQUARE_50 = 15;
const SW_SQUARE_CYCLE_16 = 16;
const SW_SQUARE_CYCLE_32 = 17;
const SW_SQUARE_CYCLE_64 = 18;
let x = 0xf01ba80;
function noiseTone(osc, position, cycle) {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x & 0xffff) - 0x7fff;
}
function sineTone(osc, position, cycle) {
    let p = position;
    if (p >= 512) {
        p -= 512;
    }
    if (p > 256) {
        p = 512 - p;
    }
    // Approximate sin(x * pi / 2) with the odd polynomial y = cx^5 + bx^3 + ax
    // using the constraint y(1) = 1 => a = 1 - b - c
    //   => y = c x^5 + b x^3 + (1 - b - c) * x
    //
    // Do a least-squares fit of this to sin(x * pi / 2) in the range 0..1
    // inclusive, using 21 evenly spaced points. Resulting approximation:
    //
    // sin(x*pi/2) ~= 0.0721435357258*x**5 - 0.642443736562*x**3 + 1.57030020084*x
    // Scale the constants by 32767 to match the desired output range.
    const c = 0.0721435357258 * 32767;
    const b = -0.642443736562 * 32767;
    const a = 1.57030020084 * 32767;
    // Calculate using y = ((c * x^2 + b) * x^2 + a) * x
    //
    // The position p is x * 256, so after each multiply with p we need to
    // shift right by 8 bits to keep the decimal point in the same place.  (The
    // approximation has a negative error near x=1 which helps avoid overflow.)
    const p2 = p * p;
    const u = (c * p2 >> 16) + b;
    const v = (u * p2 >> 16) + a;
    const w = v * p >> 8;
    // The result is within 7/32767 or 0.02%, signal-to-error ratio about 38 dB.
    return position >= 512 ? -w : w;
}
function sawtoothTone(osc, position, cycle) {
    return (position << 6) - 0x7fff;
}
function triangleTone(osc, position, cycle) {
    return position < 512 ? (position << 7) - 0x7fff : ((1023 - position) << 7) - 0x7fff;
}
function squareWaveTone(osc, position, cycle) {
    return position < (102 * (osc.wave - SW_SQUARE_10 + 1)) ? -0x7fff : 0x7fff;
}
let tunedSeed = 0xf01ba80;
function tunedNoiseTone(osc, position, cycle) {
    // Generate a square wave filtered by a random bit sequence. Since the generator
    // is called multiple times per wave, use PlayingSound state data to ensure we
    // only generate a random bit once per wave, and then reuse it for future
    // calls for that wave.
    //
    // Use the low 6 bits of generatorState to store the last-used cycle, and
    // random_bit to store the last on/off state. (random_bit is arbitrary as
    // long as it isn't one of the low 6 bits.)
    const random_bit = 0x8000;
    const prev_cycle = osc.generatorState & 0x3f;
    let is_on;
    if (cycle == prev_cycle) {
        is_on = osc.generatorState & random_bit;
    }
    else {
        // see https://en.wikipedia.org/wiki/Xorshift
        tunedSeed ^= tunedSeed << 13;
        tunedSeed ^= tunedSeed >> 17;
        tunedSeed ^= tunedSeed << 5;
        is_on = (tunedSeed & random_bit);
        osc.generatorState = (cycle & 0x3f) | is_on;
    }
    if (!is_on)
        return 0;
    return position < 512 ? -0x7fff : 0x7fff;
}
// Bit patterns for use by the cyclic noise tone.
//
// The bit pattern is arbitrary, but should have equal numbers of 0 and 1 bits,
// and should avoid long identical-bit runs for the lower parts. The values below
// were chosen based on a random permutation of the hex nibbles 0..f and then
// hand-tweaked by swapping some nibbles. Generated by:
//
//   shuf -i 0-15 | perl -ne 's/(\d+)/printf("%x",$1)/e'
const cycle_bits = [0x2df0eb47, 0xc8165a93];
const cycle_mask = [0xf, 0x1f, 0x3f];
function cycleNoiseTone(osc, position, cycle) {
    // Generate a square wave filtered by a short-cycle pseudorandom bit sequence.
    // The bit sequence repeats every 16/32/64 waves.
    //
    // The "cycle" argument corresponds to the sequential number of the generated
    // wave. This is currently a 6-bit value. Since the pseudorandom bit sequences
    // evenly fit into this, there's no need to track generator state.
    const cycle_index = osc.wave - SW_SQUARE_CYCLE_16;
    // CLAMP(0, cycle_index, sizeof cycle_bits / sizeof cycle_bits[0])
    cycle &= cycle_mask[cycle_index];
    const is_on = (cycle_bits[cycle >> 5] & (1 << (cycle & 0x1f)));
    if (!is_on)
        return 0;
    return position < 512 ? -0x7fff : 0x7fff;
}
function silenceTone(osc, position, cycle) {
    return 0;
}
function getWaveFn(wave) {
    switch (wave) {
        case SW_TRIANGLE:
            return triangleTone;
        case SW_SAWTOOTH:
            return sawtoothTone;
        case SW_TUNEDNOISE:
            return tunedNoiseTone;
        case SW_NOISE:
            return noiseTone;
        case SW_SINE:
            return sineTone;
        default:
            if (SW_SQUARE_10 <= wave && wave <= SW_SQUARE_50)
                return squareWaveTone;
            if (SW_SQUARE_CYCLE_16 <= wave && wave <= SW_SQUARE_CYCLE_64)
                return cycleNoiseTone;
            else
                return silenceTone;
    }
}
function createOscillator(wave) {
    const osc = {
        wave: wave,
        waveFn: getWaveFn(wave),
        generatorState: 0,
        position: 0,
        value: 0
    };
    return osc;
}
function createDefaultSynth() {
    return {
        osc: createOscillator(SW_SINE),
        ampEnvelope: createEnvelope(100, 100, 0.5, 200, 1, 0 /* Interpolation.Linear */),
        pitchEnvelope: createEnvelope(100, 100, 0.5, 200, 0, 0 /* Interpolation.Linear */),
        gateOn: false,
        frequency: 440,
        pitchBend: 0,
        pitchBendRange: 1200,
        ampLFO: createLFO(1, 0, 0 /* LFOWave.Sine */),
        pitchLFO: createLFO(1, 0, 0 /* LFOWave.Sine */)
    };
}
let debug = [];
function fillSamples(synth, output) {
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
        const pitchEnvelopeRange = 1024;
        const frequency = baseFrequency + synth.pitchEnvelope.amplitude * synth.pitchEnvelope.value * pitchEnvelopeRange + synth.pitchLFO.amplitude * synth.pitchLFO.value * pitchEnvelopeRange;
        const amplitude = Math.max(synth.ampEnvelope.amplitude * synth.ampEnvelope.value - synth.ampLFO.amplitude * synth.ampLFO.value, 0);
        advanceOscillator(synth.osc, frequency);
        output[i] = synth.osc.value * amplitude;
    }
}
function millisToSamples(millis) {
    return Math.floor(millis * sampleRate / 1000);
}
;
class MixerAudioWorkletProcessor extends AudioWorkletProcessor {
    synth;
    constructor() {
        super();
        this.synth = createDefaultSynth();
        this.port.onmessage = event => {
            handleMessage(this.synth, event.data);
        };
    }
    process(inputs, outputs, parameters) {
        const output = outputs[0][0];
        if (output) {
            fillSamples(this.synth, output);
            for (let i = 1; i < outputs.length; ++i) {
                for (const channel of outputs[i]) {
                    channel.set(output);
                }
            }
        }
        return true;
    }
}
registerProcessor("pxt-monosynth-audio-worklet-processor", MixerAudioWorkletProcessor);
