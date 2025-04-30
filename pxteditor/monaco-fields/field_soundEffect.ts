import { MonacoReactFieldEditor } from "./field_react";
import { registerMonacoFieldEditor } from "./monacoFieldEditor";

const fieldEditorId = "soundeffect-editor";

// music.createSoundEffect(WaveShape.Sine, 5000, 0, 255, 0, 500, SoundExpressionEffect.None, InterpolationCurve.Linear

export class MonacoSoundEffectEditor extends MonacoReactFieldEditor<pxt.assets.Sound> {
    protected value: pxt.assets.Sound;

    protected textToValue(text: string): pxt.assets.Sound {
        const out = defaultSound();
        this.value = out;

        const argMatch = /\(([^)]*)\)/.exec(text);

        const args = argMatch[1].split(",").map(a => a.replace(/\s/g, ""));

        if (args.length !== 8) return out;

        switch (args[0]) {
            case "WaveShape.Sawtooth":
                out.wave = "sawtooth";
                break;
            case "WaveShape.Square":
                out.wave = "square";
                break;
            case "WaveShape.Noise":
                out.wave = "noise";
                break;
            case "WaveShape.Triangle":
                out.wave = "triangle";
                break;
            case "WaveShape.Sine":
            default:
                out.wave = "sine";
                break;
        }

        const withDefault = (val: number, def: number) => {
            return isNaN(val) ? def : val;
        }

        out.startFrequency = withDefault(parseInt(args[1]), out.startFrequency);
        out.endFrequency = withDefault(parseInt(args[2]), out.endFrequency);
        out.startVolume = withDefault(parseInt(args[3]), out.startVolume);
        out.endVolume = withDefault(parseInt(args[4]), out.endVolume);
        out.duration = withDefault(parseInt(args[5]), out.duration);

        switch (args[6]) {
            case "SoundExpressionEffect.Vibrato":
                out.effect = "vibrato";
                break;
            case "SoundExpressionEffect.Tremolo":
                out.effect = "tremolo";
                break;
            case "SoundExpressionEffect.Warble":
                out.effect = "warble";
                break;
            case "SoundExpressionEffect.None":
            default:
                out.effect = "none";
                break;
        }

        switch (args[7]) {
            case "InterpolationCurve.Logarithmic":
                out.interpolation = "logarithmic";
                break;
            case "InterpolationCurve.Curve":
                out.interpolation = "curve";
                break;
            case "InterpolationCurve.Linear":
            default:
                out.interpolation = "linear";
                break;
        }

        return out;
    }

    protected resultToText(result: pxt.assets.Sound): string {
        result = this.value;

        let waveShape: string;

        switch (result.wave) {
            case "sine":
                waveShape = "WaveShape.Sine";
                break;
            case "square":
                waveShape = "WaveShape.Square";
                break;
            case "triangle":
                waveShape = "WaveShape.Triangle";
                break;
            case "noise":
                waveShape = "WaveShape.Noise";
                break;
            case "sawtooth":
                waveShape = "WaveShape.Sawtooth";
                break;
        }

        let effect: string;

        switch (result.effect) {
            case "vibrato":
                effect = "SoundExpressionEffect.Vibrato";
                break;
            case "tremolo":
                effect = "SoundExpressionEffect.Tremolo";
                break;
            case "warble":
                effect = "SoundExpressionEffect.Warble";
                break;
            case "none":
                effect = "SoundExpressionEffect.None";
                break;
        }

        let interpolation: string;

        switch (result.interpolation) {
            case "curve":
                interpolation = "InterpolationCurve.Curve";
                break;
            case "linear":
                interpolation = "InterpolationCurve.Linear";
                break;
            case "logarithmic":
                interpolation = "InterpolationCurve.Logarithmic";
                break;
        }

        return `music.createSoundEffect(${waveShape}, ${Math.round(result.startFrequency)}, ${Math.round(result.endFrequency)}, ${Math.round(result.startVolume)}, ${Math.round(result.endVolume)}, ${Math.round(result.duration)}, ${effect}, ${interpolation})`
    }

    protected getFieldEditorId() {
        return fieldEditorId;
    }

    protected getOptions(): any {
        return {
            onClose: () => this.fv.hide(),
            onSoundChange: (newValue: pxt.assets.Sound) => this.value = newValue,
            initialSound: this.value,
            useFlex: true,
            useMixerSynthesizer: pxt.appTarget.id !== "microbit" // FIXME
        };
    }
}

function validateRange(range: monaco.Range, model: monaco.editor.ITextModel) {
    let currentLine = range.startLineNumber;
    let currentColumn = 0;
    let foundStart = false;
    let parenCount = 0;

    const methodName = "createSoundEffect";
    const totalLines = model.getLineCount();

    while (currentLine < totalLines) {
        const lineContent = model.getLineContent(currentLine);
        const startIndex = lineContent.indexOf(methodName)
        if (startIndex !== -1) {
            foundStart = true;
            currentColumn = startIndex + methodName.length;
        }

        if (foundStart) {
            while (currentColumn < lineContent.length) {
                const currentChar = lineContent.charAt(currentColumn)
                if (currentChar === "(") {
                    parenCount++
                }
                else if (currentChar === ")") {
                    parenCount--;

                    if (parenCount === 0) {
                        return new monaco.Range(range.startLineNumber, range.startColumn, currentLine, currentColumn + model.getLineMinColumn(currentLine) + 1)
                    }
                }
                currentColumn ++;
            }
        }

        currentColumn = 0;
        currentLine ++;
    }

    return undefined;
}

function defaultSound(): pxt.assets.Sound {
    return {
        wave: "sine",
        startFrequency: 5000,
        endFrequency: 0,
        startVolume: 255,
        endVolume: 0,
        duration: 500,
        effect: "none",
        interpolation: "linear"
    }
}

export const soundEditorDefinition: pxt.editor.MonacoFieldEditorDefinition = {
    id: fieldEditorId,
    foldMatches: true,
    glyphCssClass: "fas fa-music sprite-focus-hover",
    heightInPixels: 510,
    matcher: {
        // match both JS and python
        searchString: "music\\s*\\.\\s*createSoundEffect\\s*\\(",
        isRegex: true,
        matchCase: true,
        matchWholeWord: false,
        validateRange
    },
    proto: MonacoSoundEffectEditor
};

registerMonacoFieldEditor(fieldEditorId, soundEditorDefinition);