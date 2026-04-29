import { PianoRollTheme } from "./context";

export function isBlackKey(note: number) {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
}

export function getNoteName(note: number, includeOctave: boolean = true) {
    const noteInOctave = note % 12;
    const octave = Math.floor(note / 12);
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return includeOctave ? `${noteNames[noteInOctave]}${octave}` : noteNames[noteInOctave];
}

export function range(start: number, end: number) {
    return Array.from({ length: end - start }, (_, i) => start + i);
}

export function noteWidth(theme: PianoRollTheme, duration: number) {
    return (theme.octaveWidth / 16) * duration + 1;
}

export function noteLeft(theme: PianoRollTheme, start: number) {
    return (theme.octaveWidth / 16) * start;
}

export function noteTop(theme: PianoRollTheme, note: number) {
    return (maxNote(theme) - note) * noteHeight(theme);
}

export function noteHeight(theme: PianoRollTheme) {
    return octaveHeight(theme) / 12;
}

export function octaveHeight(theme: PianoRollTheme) {
    return theme.whiteKeyHeight * 7;
}

export function workspaceHeight(theme: PianoRollTheme) {
    return (theme.maxOctave - theme.minOctave + 1) * octaveHeight(theme);
}

export function workspaceWidth(theme: PianoRollTheme) {
    return theme.measures * theme.octaveWidth;
}

export function xToTick(theme: PianoRollTheme, x: number) {
    return Math.floor(x / (theme.octaveWidth / 16));
}

export function yToNote(theme: PianoRollTheme, y: number) {
    const note = maxNote(theme) - Math.floor(y / noteHeight(theme));
    return note;
}

export function maxNote(theme: PianoRollTheme) {
    return (theme.maxOctave + 1) * 12 - 1;
}

export function minNote(theme: PianoRollTheme) {
    return theme.minOctave * 12;
}
