declare const sampleRate: number;

const MIN_NOTE = 0;
const MAX_NOTE = 127;
const MIDI_NOTE_0_FREQ = 8.17579891564;
const PITCH_MOD_RANGE = 24; // 2 octaves

function millisToSamples(millis: number): number {
    return Math.floor(millis * sampleRate / 1000);
}

function midiNoteToFrequency(note: number) {
    return MIDI_NOTE_0_FREQ * Math.pow(2, note / 12);
}

function frequencyToMidiNote(frequency: number) {
    return Math.log2(frequency / MIDI_NOTE_0_FREQ) * 12
}