export const BEAT_WIDTH = 150;
export const STAFF_ROW_HEIGHT = 50;
export const CLEF_WIDTH = 250;
export const CLEF_HEIGHT = 320;

export const STAFF_HEADER_HEIGHT = STAFF_ROW_HEIGHT;
export const STAFF_HEADER_FONT_SIZE = 40;
export const STAFF_HEADER_OFFSET = 10;
export const STAFF_END_WIDTH = 25;
export const STAFF_GRID_TICK_HEIGHT = 7;

export const WORKSPACE_HEIGHT = STAFF_HEADER_HEIGHT + STAFF_ROW_HEIGHT * 7;
export const NOTE_ICON_WIDTH = 45;
export const NOTE_DURATION_HEIGHT = NOTE_ICON_WIDTH / 3;

export const BASS_STAFF_TOP = WORKSPACE_HEIGHT;
export const BASS_STAFF_HEADER_HEIGHT = STAFF_ROW_HEIGHT / 2;
export const BASS_CLEF_TOP = 90;
export const BASS_CLEF_HEIGHT = 230;

export function workspaceWidth(measures: number, beatsPerMeasure: number) {
    return CLEF_WIDTH + measures * beatsPerMeasure * BEAT_WIDTH + STAFF_END_WIDTH;
}

export function tickToX(ticksPerBeat: number, tick: number) {
    return CLEF_WIDTH + (BEAT_WIDTH / ticksPerBeat) * tick;
}

export function beatToX(beat: number) {
    return CLEF_WIDTH + BEAT_WIDTH * beat;
}

export function closestTick(ticksPerBeat: number, x: number, gridTicks?: number) {
    const tick = Math.round((x - CLEF_WIDTH) * (ticksPerBeat / BEAT_WIDTH));
    return Math.round(tick / gridTicks) * gridTicks
}

export function closestRow(y: number) {
    const isBassClef = y > BASS_STAFF_TOP
    return 12 - Math.round((y - STAFF_HEADER_HEIGHT - (isBassClef ? BASS_STAFF_TOP : 0)) / (STAFF_ROW_HEIGHT / 2))
}

export function rowY(row: number, isBassClef: boolean) {
    if (isBassClef) {
        return BASS_STAFF_TOP + STAFF_HEADER_HEIGHT + (12 - (row % 12)) * STAFF_ROW_HEIGHT / 2;
    }
    return STAFF_HEADER_HEIGHT + (12 - (row % 12)) * STAFF_ROW_HEIGHT / 2;
}