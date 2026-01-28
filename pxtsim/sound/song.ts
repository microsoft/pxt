/// <reference path="../../localtypings/pxtmusic.d.ts" />

namespace pxsim.music {
    const BUFFER_SIZE = 12;

    export function renderInstrument(instrument: pxt.assets.music.Instrument, noteFrequency: number, gateLength: number, volume: number) {
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

    export function renderDrumInstrument(sound: pxt.assets.music.DrumInstrument, volume: number) {
        let prevAmp = sound.startVolume;
        let prevFreq = sound.startFrequency;

        const scaleVolume = (value: number) => (value / 1024) * volume;

        let out = new Uint8Array((sound.steps.length + 1) * BUFFER_SIZE);

        for (let i = 0; i < sound.steps.length; i++) {
            addNote(
                out,
                i * BUFFER_SIZE,
                sound.steps[i].duration,
                scaleVolume(prevAmp),
                scaleVolume(sound.steps[i].volume),
                sound.steps[i].waveform,
                prevFreq,
                sound.steps[i].frequency
            );
            prevAmp = sound.steps[i].volume;
            prevFreq = sound.steps[i].frequency
        }

        addNote(
            out,
            sound.steps.length * BUFFER_SIZE,
            10,
            scaleVolume(prevAmp),
            0,
            sound.steps[sound.steps.length - 1].waveform,
            prevFreq,
            prevFreq
        );

        return out;
    }

    function instrumentPitchAtTime(instrument: pxt.assets.music.Instrument, noteFrequency: number, gateLength: number, time: number) {
        let mod = 0;
        if (instrument.pitchEnvelope?.amplitude) {
            mod += envelopeValueAtTime(instrument.pitchEnvelope, time, gateLength)
        }
        if (instrument.pitchLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.pitchLFO, time)
        }
        return Math.max(noteFrequency + mod, 0);
    }

    function instrumentVolumeAtTime(instrument: pxt.assets.music.Instrument, gateLength: number, time: number, maxVolume: number) {
        let mod = 0;
        if (instrument.ampEnvelope.amplitude) {
            mod += envelopeValueAtTime(instrument.ampEnvelope, time, gateLength)
        }
        if (instrument.ampLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.ampLFO, time)
        }
        return ((Math.max(Math.min(mod, instrument.ampEnvelope.amplitude), 0) / 1024) * maxVolume) | 0;
    }

    function envelopeValueAtTime(envelope: pxt.assets.music.Envelope, time: number, gateLength: number) {
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

    function lfoValueAtTime(lfo: pxt.assets.music.LFO, time: number) {
        return Math.cos(((time / 1000) * lfo.frequency) * 2 * Math.PI) * lfo.amplitude
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

    function set16BitNumber(buf: Uint8Array, offset: number, value: number) {
        const temp = new Uint8Array(2);
        new Uint16Array(temp.buffer)[0] = value | 0;
        buf[offset] = temp[0];
        buf[offset + 1] = temp[1];
    }

    function get16BitNumber(buf: Uint8Array, offset: number) {
        const temp = new Uint8Array(2);
        temp[0] = buf[offset];
        temp[1] = buf[offset + 1];

        return new Uint16Array(temp.buffer)[0];
    }

    export function decodeSong(buf: Uint8Array) {
        const res: pxt.assets.music.Song = {
            beatsPerMinute: get16BitNumber(buf, 1),
            beatsPerMeasure: buf[3],
            ticksPerBeat: buf[4],
            measures: buf[5],
            tracks: []
        };

        let current = 7;

        while (current < buf.length) {
            const [track, pointer] = decodeTrack(buf, current);
            current = pointer;
            res.tracks.push(track);
        }

        return res;
    }

    function decodeInstrument(buf: Uint8Array, offset: number): pxt.assets.music.Instrument {
        return {
            waveform: buf[offset],
            ampEnvelope: {
                attack: get16BitNumber(buf, offset + 1),
                decay: get16BitNumber(buf, offset + 3),
                sustain: get16BitNumber(buf, offset + 5),
                release: get16BitNumber(buf, offset + 7),
                amplitude: get16BitNumber(buf, offset + 9),
            },
            pitchEnvelope: {
                attack: get16BitNumber(buf, offset + 11),
                decay: get16BitNumber(buf, offset + 13),
                sustain: get16BitNumber(buf, offset + 15),
                release: get16BitNumber(buf, offset + 17),
                amplitude: get16BitNumber(buf, offset + 19),
            },
            ampLFO: {
                frequency: buf[offset + 21],
                amplitude: get16BitNumber(buf, offset + 22)
            },
            pitchLFO: {
                frequency: buf[offset + 24],
                amplitude: get16BitNumber(buf, offset + 25)
            },
            octave: buf[offset + 27]
        }
    }

    function decodeTrack(buf: Uint8Array, offset: number): [pxt.assets.music.Track, number] {
        if (buf[offset + 1]) {
            return decodeDrumTrack(buf, offset);
        }

        return decodeMelodicTrack(buf, offset);
    }

    function decodeDrumInstrument(buf: Uint8Array, offset: number): pxt.assets.music.DrumInstrument {
        const res: pxt.assets.music.DrumInstrument = {
            startFrequency: get16BitNumber(buf, offset + 1),
            startVolume: get16BitNumber(buf, offset + 3),
            steps: []
        };

        for (let i = 0; i < buf[offset]; i++) {
            const start = offset + 5 + i * 7;
            res.steps.push({
                waveform: buf[start],
                frequency: get16BitNumber(buf, start + 1),
                volume: get16BitNumber(buf, start + 3),
                duration: get16BitNumber(buf, start + 5)
            })
        }

        return res;
    }

    function decodeNoteEvent(buf: Uint8Array, offset: number, instrumentOctave: number, isDrumTrack: boolean): pxt.assets.music.NoteEvent {
        const res: pxt.assets.music.NoteEvent = {
            startTick: get16BitNumber(buf, offset),
            endTick: get16BitNumber(buf, offset + 2),
            notes: []
        };

        for (let i = 0; i < buf[offset + 4]; i++) {
            res.notes.push(decodeNote(buf[offset + 5 + i], instrumentOctave, isDrumTrack));
        }
        return res;
    }

    function decodeNote(note: number, instrumentOctave: number, isDrumTrack: boolean) {
        const flags = note >> 6;

        const result: pxt.assets.music.Note = {
            note: isDrumTrack ? note : ((note & 0x3f) + (instrumentOctave - 2) * 12),
            enharmonicSpelling: "normal"
        }

        if (flags === 1) {
            result.enharmonicSpelling = "flat";
        }
        else if (flags === 2) {
            result.enharmonicSpelling = "sharp";
        }

        return result;
    }

    function decodeMelodicTrack(buf: Uint8Array, offset: number): [pxt.assets.music.Track, number] {
        const res: pxt.assets.music.Track = {
            id: buf[offset],
            instrument: decodeInstrument(buf, offset + 4),
            notes: []
        };

        const noteStart = offset + 4 + get16BitNumber(buf, offset + 2);
        const noteLength = get16BitNumber(buf, noteStart);

        let currentOffset = noteStart + 2;

        while (currentOffset < noteStart + 2 + noteLength) {
            res.notes.push(decodeNoteEvent(buf, currentOffset, res.instrument.octave, false));
            currentOffset += 5 + res.notes[res.notes.length - 1].notes.length
        }

        return [res, currentOffset];
    }

    function decodeDrumTrack(buf: Uint8Array, offset: number): [pxt.assets.music.Track, number] {
        const res: pxt.assets.music.Track = {
            id: buf[offset],
            instrument: { ampEnvelope: { attack: 0, decay: 0, sustain: 0, release: 0, amplitude: 0 }, waveform: 0 },
            notes: [],
            drums: []
        };

        const drumByteLength = get16BitNumber(buf, offset + 2);
        let currentOffset = offset + 4;

        while (currentOffset < offset + 4 + drumByteLength) {
            res.drums.push(decodeDrumInstrument(buf, currentOffset));
            currentOffset += 5 + 7 * res.drums[res.drums.length - 1].steps.length;
        }

        const noteLength = get16BitNumber(buf, currentOffset);
        currentOffset += 2;

        while (currentOffset < offset + 4 + drumByteLength + noteLength) {
            res.notes.push(decodeNoteEvent(buf, currentOffset, 0, true));
            currentOffset += 5 + res.notes[res.notes.length - 1].notes.length
        }

        return [res, currentOffset];
    }
}