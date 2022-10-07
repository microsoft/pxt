export const BEAT_WIDTH = 150;
export const STAFF_ROW_HEIGHT = 50;
export const CLEF_WIDTH = 250;
export const CLEF_HEIGHT = 320;

export const STAFF_HEADER_HEIGHT = STAFF_ROW_HEIGHT;
export const STAFF_HEADER_FONT_SIZE = 40;
export const STAFF_HEADER_OFFSET = 10;

export const WORKSPACE_HEIGHT = STAFF_HEADER_HEIGHT + STAFF_ROW_HEIGHT * 7;
export const NOTE_ICON_WIDTH = 45;
export const NOTE_DURATION_HEIGHT = NOTE_ICON_WIDTH / 3;

export function workspaceWidth(song: pxt.assets.music.Song) {
    return CLEF_WIDTH + song.measures * song.beatsPerMeasure * BEAT_WIDTH;
}

export function tickToX(song: pxt.assets.music.Song, tick: number) {
    return CLEF_WIDTH + (BEAT_WIDTH / song.ticksPerBeat) * tick;
}

export function beatToX(beat: number) {
    return CLEF_WIDTH + BEAT_WIDTH * beat;
}

export function closestTick(song: pxt.assets.music.Song, x: number, gridTicks?: number) {
    const tick = Math.round((x - CLEF_WIDTH) * (song.ticksPerBeat / BEAT_WIDTH));
    return Math.round(tick / gridTicks) * gridTicks
}

export function closestRow(y: number) {
    return 12 - Math.round((y - STAFF_HEADER_HEIGHT) / (STAFF_ROW_HEIGHT / 2))
}

export function rowY(row: number) {
    return STAFF_HEADER_HEIGHT + (12 - (row % 12)) * STAFF_ROW_HEIGHT / 2;
}