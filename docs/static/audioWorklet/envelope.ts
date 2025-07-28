interface Envelope {
    // samples
    attack: number;
    // samples
    decay: number;
    // 0-1
    sustain: number;
    // samples
    release: number;
    // 0-1
    amplitude: number;

    samplesLeft: number;
    value: number;
    stageStartValue: number;

    interpolation: (value: number) => number;

    stage: EnvelopeStage;
}

const enum EnvelopeStage {
    Attack = 0,
    Decay = 1,
    Sustain = 2,
    Release = 3,
    Idle = 4,
}

function advanceEnvelope(envelope: Envelope, gateOn: boolean): void {
    if (envelope.amplitude === 0) {
        return;
    }


    if (gateOn) {
        if (envelope.stage === EnvelopeStage.Idle || envelope.stage === EnvelopeStage.Release) {
            envelope.samplesLeft = envelope.attack;
            envelope.stage = EnvelopeStage.Attack;
            envelope.stageStartValue = envelope.value;
        }
        else if (envelope.stage === EnvelopeStage.Attack) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = envelope.stageStartValue + envelope.interpolation(1 - envelope.samplesLeft / envelope.attack);
                if (envelope.value > 1) {
                    envelope.value = 1;
                    envelope.stage = EnvelopeStage.Decay;
                    envelope.samplesLeft = envelope.decay;
                }
            }
            else {
                envelope.samplesLeft = envelope.decay;
                envelope.stage = EnvelopeStage.Decay;
                envelope.value = 1;
            }
        }
        else if (envelope.stage === EnvelopeStage.Decay) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = 1 - envelope.interpolation(1 - envelope.samplesLeft / envelope.decay) * (1 - envelope.sustain);

                if (envelope.value < envelope.sustain) {
                    envelope.value = envelope.sustain;
                    envelope.stage = EnvelopeStage.Sustain;
                }
            }
            else {
                envelope.stage = EnvelopeStage.Sustain;
                envelope.value = envelope.sustain;
            }
        }
    }
    else {
        if (envelope.stage === EnvelopeStage.Release) {
            if (envelope.samplesLeft > 0) {
                envelope.samplesLeft--;
                envelope.value = envelope.stageStartValue - envelope.interpolation(1 - envelope.samplesLeft / envelope.release) * envelope.stageStartValue;
                if (envelope.value < 0) {
                    envelope.value = 0;
                    envelope.stage = EnvelopeStage.Idle;
                }
            }
            else {
                envelope.stage = EnvelopeStage.Idle;
                envelope.samplesLeft = 0;
            }
        }
        else if (envelope.stage !== EnvelopeStage.Idle) {
            envelope.stage = EnvelopeStage.Release;
            envelope.samplesLeft = envelope.release;
            envelope.stageStartValue = envelope.value;
        }
    }
}


function setEnvelopeParam(envelope: Envelope, param: number, value: number): void {
    switch (param) {
        case EnvelopeParamIndex.Attack:
            envelope.attack = millisToSamples(value);
            break;
        case EnvelopeParamIndex.Decay:
            envelope.decay = millisToSamples(value);
            break;
        case EnvelopeParamIndex.Sustain:
            envelope.sustain = value / 0x7fff;
            break;
        case EnvelopeParamIndex.Release:
            envelope.release = millisToSamples(value);
            break;
        case EnvelopeParamIndex.Amplitude:
            envelope.amplitude = value / 0x7fff;
            break;
        case EnvelopeParamIndex.Interpolation:
            envelope.interpolation = interpolationFunction(value);
            break;
        default:
            throw new Error("Unknown envelope parameter");
    }
}

function createEnvelope(attack: number, decay: number, sustain: number, release: number, amplitude: number, interpolation: Interpolation): Envelope {
    return {
        attack: millisToSamples(attack),
        decay: millisToSamples(decay),
        sustain,
        release: millisToSamples(release),
        amplitude,
        samplesLeft: 0,
        value: 0,
        stageStartValue: 0,
        stage: EnvelopeStage.Idle,
        interpolation: interpolationFunction(interpolation)
    }
}