namespace pxt.assets.music {
    export interface Instrument {
        waveform: number;
        ampEnvelope: Envelope;
        pitchEnvelope?: Envelope;
        ampLFO?: LFO;
        pitchLFO?: LFO;
    }

    export interface Envelope {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
        amplitude: number;
    }

    export interface LFO {
        frequency: number;
        amplitude: number;
    }

    export interface Song {
        measures: number;
        beatsPerMeasure: number;
        beatsPerMinute: number;
        ticksPerBeat: number;
        tracks: Track[];
    }

    export interface Track {
        instrument: Instrument;
        notes: NoteEvent[];
    }

    export interface NoteEvent {
        notes: number[];
        startTick: number;
        endTick: number;
    }

    const BUFFER_SIZE = 12;

    export function renderInstrument(instrument: Instrument, noteFrequency: number, gateLength: number, volume: number) {
        const totalDuration = gateLength + instrument.ampEnvelope.release;

        const ampLFOInterval = instrument.ampLFO?.amplitude ? Math.max(500 / instrument.ampLFO.frequency, 50) : 50;
        const pitchLFOInterval = instrument.pitchLFO?.amplitude ? Math.max(500 / instrument.pitchLFO.frequency, 50) : 50;

        let timePoints = [0];

        let nextAETime = instrument.ampEnvelope.attack;
        let nextPETime = instrument.pitchEnvelope?.amplitude ? instrument.pitchEnvelope.attack : totalDuration;
        let nextPLTime = instrument.pitchLFO?.amplitude ? pitchLFOInterval : totalDuration;
        let nextALTime = instrument.ampLFO?.amplitude ? ampLFOInterval : totalDuration;

        let time = 0;
        while (time < totalDuration) {
            if (nextAETime <= nextPETime && nextAETime <= nextPLTime && nextAETime <= nextALTime) {
                time = nextAETime;
                timePoints.push(nextAETime);

                if (time < instrument.ampEnvelope.attack + instrument.ampEnvelope.decay && instrument.ampEnvelope.attack + instrument.ampEnvelope.decay < gateLength) {
                    nextAETime = instrument.ampEnvelope.attack + instrument.ampEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextAETime = gateLength;
                }
                else {
                    nextAETime = totalDuration;
                }
            }
            else if (nextPETime <= nextPLTime && nextPETime <= nextALTime && nextPETime < totalDuration) {
                time = nextPETime;
                timePoints.push(nextPETime);
                if (time < instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay && instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay < gateLength) {
                    nextPETime = instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextPETime = gateLength;
                }
                else if (time < gateLength + instrument.pitchEnvelope.release) {
                    nextPETime = Math.min(totalDuration, gateLength + instrument.pitchEnvelope.release);
                }
                else {
                    nextPETime = totalDuration
                }
            }
            else if (nextPLTime <= nextALTime && nextPLTime < totalDuration) {
                time = nextPLTime;
                timePoints.push(nextPLTime);
                nextPLTime += pitchLFOInterval;
            }
            else if (nextALTime < totalDuration) {
                time = nextALTime;
                timePoints.push(nextALTime);
                nextALTime += ampLFOInterval;
            }


            if (time >= totalDuration) {
                break;
            }

            if (nextAETime <= time) {
                if (time < instrument.ampEnvelope.attack + instrument.ampEnvelope.decay && instrument.ampEnvelope.attack + instrument.ampEnvelope.decay < gateLength) {
                    nextAETime = instrument.ampEnvelope.attack + instrument.ampEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextAETime = gateLength;
                }
                else {
                    nextAETime = totalDuration;
                }
            }
            if (nextPETime <= time) {
                if (time < instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay && instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay < gateLength) {
                    nextPETime = instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextPETime = gateLength;
                }
                else if (time < gateLength + instrument.pitchEnvelope.release) {
                    nextPETime = Math.min(totalDuration, gateLength + instrument.pitchEnvelope.release);
                }
                else {
                    nextPETime = totalDuration
                }
            }
            while (nextALTime <= time) {
                nextALTime += ampLFOInterval;
            }
            while (nextPLTime <= time) {
                nextPLTime += pitchLFOInterval;
            }
        }


        let prevAmp = instrumentVolumeAtTime(instrument, gateLength, 0, volume) | 0;
        let prevPitch = instrumentPitchAtTime(instrument, noteFrequency, gateLength, 0) | 0;
        let prevTime = 0;

        let nextAmp: number;
        let nextPitch: number;
        const out = new Uint8Array(BUFFER_SIZE * (timePoints.length + 1));
        for (let i = 1; i < timePoints.length; i++) {
            if (timePoints[i] - prevTime < 5) {
                prevTime = timePoints[i];
                continue;
            }

            nextAmp = instrumentVolumeAtTime(instrument, gateLength, timePoints[i], volume) | 0;
            nextPitch = instrumentPitchAtTime(instrument, noteFrequency, gateLength, timePoints[i]) | 0
            addNote(
                out,
                (i - 1) * 12,
                (timePoints[i] - prevTime) | 0,
                prevAmp,
                nextAmp,
                instrument.waveform,
                prevPitch,
                nextPitch
            )

            prevAmp = nextAmp;
            prevPitch = nextPitch;
            prevTime = timePoints[i];
        }
        addNote(
            out,
            timePoints.length * 12,
            10,
            prevAmp,
            0,
            instrument.waveform,
            prevPitch,
            prevPitch
        )
        return out;
    }

    function instrumentPitchAtTime(instrument: Instrument, noteFrequency: number, gateLength: number, time: number) {
        let mod = 0;
        if (instrument.pitchEnvelope?.amplitude) {
            mod += envelopeValueAtTime(instrument.pitchEnvelope, time, gateLength)
        }
        if (instrument.pitchLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.pitchLFO, time)
        }
        return Math.max(noteFrequency + mod, 0);
    }

    function instrumentVolumeAtTime(instrument: Instrument, gateLength: number, time: number, maxVolume: number) {
        let mod = 0;
        if (instrument.ampEnvelope.amplitude) {
            mod += envelopeValueAtTime(instrument.ampEnvelope, time, gateLength)
        }
        if (instrument.ampLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.ampLFO, time)
        }
        return ((Math.max(Math.min(mod, instrument.ampEnvelope.amplitude), 0) / 1024) * maxVolume) | 0;
    }

    function envelopeValueAtTime(envelope: Envelope, time: number, gateLength: number) {
        const adjustedSustain = (envelope.sustain / 1024) * envelope.amplitude;

        if (time > gateLength) {
            if (time - gateLength > envelope.release) return 0;

            else if (time < envelope.attack) {
                const height = (envelope.amplitude / envelope.attack) * gateLength;
                return height - ((height / envelope.release) * (time - gateLength))
            }
            else if (time < envelope.attack + envelope.decay) {
                const height2 = envelope.amplitude - ((envelope.amplitude - adjustedSustain) / envelope.decay) * (gateLength - envelope.attack);
                return height2 - ((height2 / envelope.release) * (time - gateLength))
            }
            else {
                return adjustedSustain - (adjustedSustain / envelope.release) * (time - gateLength)
            }
        }
        else if (time < envelope.attack) {
            return (envelope.amplitude / envelope.attack) * time
        }
        else if (time < envelope.attack + envelope.decay) {
            return envelope.amplitude - ((envelope.amplitude - adjustedSustain) / envelope.decay) * (time - envelope.attack)
        }
        else {
            return adjustedSustain;
        }
    }

    function lfoValueAtTime(lfo: LFO, time: number) {
        return Math.cos(((time / 1000) * lfo.frequency) * 2 * Math.PI) * lfo.amplitude
    }

    function set16BitNumber(buf: Uint8Array, offset: number, value: number) {
        const temp = new Uint8Array(2);
        new Uint16Array(temp.buffer)[0] = value | 0;
        buf[offset] = temp[0];
        buf[offset + 1] = temp[1];
    }

    function addNote(sndInstr: Uint8Array, sndInstrPtr: number, ms: number, beg: number, end: number, soundWave: number, hz: number, endHz: number) {
        if (ms > 0) {
            sndInstr[sndInstrPtr] = soundWave;
            sndInstr[sndInstrPtr + 1] = 0;
            set16BitNumber(sndInstr, sndInstrPtr + 2, hz)
            set16BitNumber(sndInstr, sndInstrPtr + 4, ms)
            set16BitNumber(sndInstr, sndInstrPtr + 6, (beg * 255) >> 6)
            set16BitNumber(sndInstr, sndInstrPtr + 8, (end * 255) >> 6)
            set16BitNumber(sndInstr, sndInstrPtr + 10, endHz);
            sndInstrPtr += BUFFER_SIZE;
        }
        sndInstr[sndInstrPtr] = 0;
        return sndInstrPtr
    }
}