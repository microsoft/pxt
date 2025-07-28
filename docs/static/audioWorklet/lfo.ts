interface LowFrequencyOscillator {
    period: number;
    samplesLeft: number;
    value: number;
    amplitude: number;
    triggered: boolean;

    wave: (lfo: LowFrequencyOscillator, progress: number) => number;
}

const enum LFOWave {
    Sine,
    Triangle,
    Square,
    Ramp,
    Sawtooth,
    Random
}

function advanceLFO(lfo: LowFrequencyOscillator, gateOn: boolean): void {
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

function createLFO(frequency: number, amplitude: number, wave: LFOWave): LowFrequencyOscillator {
    const lfo: LowFrequencyOscillator = {
        period: millisToSamples(1000 / frequency),
        samplesLeft: 0,
        value: 0,
        amplitude: amplitude,
        triggered: false,
        wave: getLFOWaveFunction(wave)
    };

    return lfo;
}

function getLFOWaveFunction(wave: LFOWave): (lfo: LowFrequencyOscillator, progress: number) => number {
    switch (wave) {
        case LFOWave.Sine:
            return lfoSineWave;
        case LFOWave.Triangle:
            return lfoTriangleWave;
        case LFOWave.Square:
            return lfoSquareWave;
        case LFOWave.Ramp:
            return lfoRampWave;
        case LFOWave.Sawtooth:
            return lfoSawtoothWave;
        case LFOWave.Random:
            return lfoRandomWave;
        default:
            throw new Error("Unknown LFO wave type");
    }
}

function lfoSineWave(lfo: LowFrequencyOscillator, progress: number): number {
    return (1 + Math.sin(progress * Math.PI * 2)) / 2;
}

function lfoTriangleWave(lfo: LowFrequencyOscillator, progress: number): number {
    return 1 - Math.abs(2 * progress - 1);
}

function lfoSquareWave(lfo: LowFrequencyOscillator, progress: number): number {
    return progress < 0.5 ? 0 : 1
}

function lfoRampWave(lfo: LowFrequencyOscillator, progress: number): number {
    return progress
}

function lfoSawtoothWave(lfo: LowFrequencyOscillator, progress: number): number {
    return 1 - progress;
}

function lfoRandomWave(lfo: LowFrequencyOscillator, progress: number): number {
    if (progress === 0) {
        return Math.random();
    }
    return lfo.value; // sample and hold
}

function setLFOParam(lfo: LowFrequencyOscillator, param: number, value: number): void {
    switch (param) {
        case LFOParamIndex.Frequency:
            lfo.period = millisToSamples(1000 / value);
            break;
        case LFOParamIndex.Wave:
            lfo.wave = getLFOWaveFunction(value);
            break;
        case LFOParamIndex.Amplitude:
            lfo.amplitude = value / 0x7fff;
            break;
        default:
            throw new Error("Unknown LFO parameter");
    }
}