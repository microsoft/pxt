import { MelodyStringReader, REST } from "./field_melodySandbox";
import { FieldMusicEditor, FieldMusicEditorOptions } from "./field_musiceditor";
import { isTrue } from "./field_utils";
import * as Blockly from "blockly";

interface FieldPianoRollOptions extends FieldMusicEditorOptions {
    maxPolyphony?: number;
    hideHeader?: boolean;
    borderColor?: string;
    encodeAsMelody?: boolean;
    minOctave?: number;
    maxOctave?: number;
}

export class FieldPianoRoll extends FieldMusicEditor {
    protected showInWidgetDiv: boolean;
    protected encodeAsMelody: boolean;

    override showEditor_() {
        if (this.asset && this.encodeAsMelody) {
            const field = this.getTempoField();
            if (field) {
                const bpm = parseInt(field.getValue() as string);

                if (!isNaN(bpm)) {
                    (this.asset as pxt.Song).song.beatsPerMinute = bpm;
                }
            }
        }
        super.showEditor_();
    }

    protected override getEditorKind() {
        return "piano-roll-editor";
    }

    protected override isFullscreen() {
        return !this.showInWidgetDiv;
    }

    protected override getValueText(): string {
        if (!this.encodeAsMelody) return super.getValueText();

        const song = (this.asset as pxt.Song)?.song;

        if (!song) return this.valueText || "";

        let result = "";
        const ticksPerSixteenth = song.ticksPerBeat / 4;
        let currentTick = 0;

        for (const noteEvent of song.tracks[0].notes) {
            if (noteEvent.startTick > currentTick) {
                const restDuration = Math.round((noteEvent.startTick - currentTick) / ticksPerSixteenth);
                result += `r:${restDuration} `;
            }
            const note = noteEvent.notes[0].note - 1;
            const duration = Math.round((noteEvent.endTick - noteEvent.startTick) / ticksPerSixteenth);

            const notes = "CCDDEFFGGAAB";
            const noteInOctave = note % 12;
            const octave = Math.floor(note / 12) + 1;
            const accidental = isBlackKey(note) ? "#" : "";
            result += `${notes.charAt(noteInOctave)}${accidental}${octave}:${duration} `;

            currentTick = noteEvent.endTick;
        }

        const maxTick = song.measures * song.ticksPerBeat * song.beatsPerMeasure;

        if (currentTick < maxTick) {
            const restDuration = Math.round((maxTick - currentTick) / ticksPerSixteenth);
            result += `r:${restDuration} `;
        }

        return `"${result.trim()}"`;
    }

    protected override createNewAsset(text?: string): pxt.Asset {
        if (!this.encodeAsMelody) return super.createNewAsset(text);

        const song = createEmptyMelodySong(this.temporaryAssetId());

        if (!text) return song;

        text = text.replace(/"/g, "").trim();

        const reader = new MelodyStringReader(text, true);
        let currentTick = 0;

        // melody duration is in 1/16 notes
        const ticksPerSixteenth = song.song.ticksPerBeat / 4;

        while (reader.hasNextNote()) {
            reader.readNote();

            const duration = reader.currentDuration * ticksPerSixteenth;

            if (reader.currentNote !== REST) {
                song.song.tracks[0].notes.push({
                    startTick: currentTick,
                    endTick: currentTick + duration,
                    notes: [
                        {
                            note: reader.currentNote + 1 + (reader.currentOctave - 1) * 12,
                            enharmonicSpelling: isBlackKey(reader.currentNote) ? "sharp" : "normal"
                        }
                    ]
                });
            }

            currentTick += duration;
        }

        const measures = Math.ceil(currentTick / (song.song.ticksPerBeat * song.song.beatsPerMeasure));
        song.song.measures = measures;

        return song;
    }

    protected override parseFieldOptions(opts: any): FieldPianoRollOptions {
        const result = super.parseFieldOptions(opts) as FieldPianoRollOptions;

        this.showInWidgetDiv = isTrue(opts.showInWidgetDiv);

        if (opts.maxPolyphony) {
            const maxPolyphony = parseInt(opts.maxPolyphony);
            if (!isNaN(maxPolyphony) && maxPolyphony > 0) {
                result.maxPolyphony = maxPolyphony;
            }
        }

        if (opts.minOctave) {
            const minOctave = parseInt(opts.minOctave);
            if (!isNaN(minOctave)) {
                result.minOctave = minOctave;
            }
        }

        if (opts.maxOctave) {
            const maxOctave = parseInt(opts.maxOctave);
            if (!isNaN(maxOctave)) {
                result.maxOctave = maxOctave;
            }
        }

        if (opts.hideHeader) {
            result.hideHeader = isTrue(opts.hideHeader);
        }

        if (opts.borderColor) {
            result.borderColor = opts.borderColor;
        }

        if (opts.encodeAsMelody) {
            result.encodeAsMelody = isTrue(opts.encodeAsMelody);
            this.encodeAsMelody = result.encodeAsMelody;
            if (result.encodeAsMelody) {
                result.maxPolyphony = 1;
            }
        }


        return result;
    }

    protected override onEditorClose(newValue: pxt.Asset) {
        super.onEditorClose(newValue);

        if (this.encodeAsMelody) {
            this.syncTempoField((newValue as pxt.Song).song.beatsPerMinute);
        }
    }

    protected syncTempoField(bpm: number): void {
        const field = this.getTempoField();
        if (field) {
            field.setValue(bpm);
        }
    }

    protected getTempoField(): Blockly.Field {
        const s = this.sourceBlock_;
        if (s) {
            for (const input of s.inputList) {
                if (input.name === "tempo" || input.name === "bpm") {
                    const tempoBlock = input.connection.targetBlock();
                    if (tempoBlock) {
                        if (tempoBlock.type === "math_number_minmax") {
                            return tempoBlock.getField("SLIDER");
                        }
                        else {
                            return tempoBlock.getField("NUM");
                        }
                    }
                    break;
                }
            }
        }
        return null;
    }
}

function melodyInstrument(): pxt.assets.music.Instrument {
    return {
        waveform: 1,
        ampEnvelope: {
            attack: 10,
            decay: 50,
            sustain: 1024,
            release: 10,
            amplitude: 1024
        }
    };
}

function createEmptyMelodySong(assetId: string): pxt.Song {
    const song = pxt.assets.music.getEmptySong(2);
    song.tracks = [
        {
            name: "Melody",
            id: 0xff,
            instrument: melodyInstrument(),
            notes: []
        }
    ];

    return {
        internalID: -1,
        id: assetId,
        type: pxt.AssetType.Song,
        meta: {
        },
        song
    }
}

function isBlackKey(note: number) {
    const noteInOctave = note % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
}