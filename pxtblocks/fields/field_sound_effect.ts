/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="./field_base.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldSoundEffectParams extends Blockly.FieldCustomOptions {
        durationInputName: string;
        startFrequencyInputName: string;
        endFrequencyInputName: string;
        startVolumeInputName: string;
        endVolumeInputName: string;
        waveFieldName: string;
        interpolationFieldName: string;
        effectFieldName: string;
    }

    const TOTAL_WIDTH = 80;
    const TOTAL_HEIGHT = 20;
    const X_PADDING = 5;
    const Y_PADDING = 1;

    interface SoundEffect {
        wave: number;
        startFrequency: number;
        endFrequency: number;
        startVolume: number;
        endVolume: number;
        duration: number;
        interpolation: number;
        effect: number;
    }

    export class FieldSoundEffect extends FieldBase<FieldSoundEffectParams> {
        protected asset: SoundEffect;

        protected onInit(): void {
            if (!this.options) this.options = {} as any;
            if (!this.options.durationInputName) this.options.durationInputName = "duration";
            if (!this.options.startFrequencyInputName) this.options.startFrequencyInputName = "startFrequency";
            if (!this.options.endFrequencyInputName) this.options.endFrequencyInputName = "endFrequency";
            if (!this.options.startVolumeInputName) this.options.startVolumeInputName = "startVolume";
            if (!this.options.endVolumeInputName) this.options.endVolumeInputName = "endVolume";
            if (!this.options.waveFieldName) this.options.waveFieldName = "waveShape";
            if (!this.options.interpolationFieldName) this.options.interpolationFieldName = "interpolation";
            if (!this.options.effectFieldName) this.options.effectFieldName = "effect";

            this.redrawPreview();
        }

        protected onDispose(): void {
        }

        protected onValueChanged(newValue: string): string {
            return newValue;
        }

        redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);
            const bg = new svg.Rect()
                .at(X_PADDING, Y_PADDING)
                .size(70, 8)
                .setClass("blocklySpriteField")
                .stroke("#898989", 1)
                .corner(4);

            this.fieldGroup_.appendChild(bg.el);
        }

        showEditor_() {
            const initialSound = this.readCurrentSound();
            Blockly.Events.disable();

            Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, () => {
                fv.hide();

                Blockly.Events.enable();
                Blockly.Events.setGroup(true);
                this.fireNumberInputUpdate(this.options.durationInputName, initialSound.duration);
                this.fireNumberInputUpdate(this.options.startFrequencyInputName, initialSound.startFrequency);
                this.fireNumberInputUpdate(this.options.endFrequencyInputName, initialSound.endFrequency);
                this.fireNumberInputUpdate(this.options.startVolumeInputName, initialSound.startVolume);
                this.fireNumberInputUpdate(this.options.endVolumeInputName, initialSound.endVolume);
                this.fireFieldDropdownUpdate(this.options.waveFieldName, waveformMapping[initialSound.wave]);
                this.fireFieldDropdownUpdate(this.options.interpolationFieldName, interpolationMapping[initialSound.interpolation]);
                this.fireFieldDropdownUpdate(this.options.effectFieldName, effectMapping[initialSound.effect]);
                Blockly.Events.setGroup(false);
            })
            const widgetDiv = Blockly.WidgetDiv.DIV as HTMLDivElement;
            const opts = {
                onClose: () => {
                    fv.hide();
                    Blockly.WidgetDiv.hideIfOwner(this);
                },
                onSoundChange: (newSound: pxt.assets.Sound) => {
                    this.updateSiblingBlocks(newSound);
                },
                initialSound: initialSound
            }

            const fv = pxt.react.getFieldEditorView("soundeffect-editor", this.asset, opts, widgetDiv);

            const block = this.sourceBlock_ as Blockly.BlockSvg;
            const bounds = block.getBoundingRectangle();
            const coord = workspaceToScreenCoordinates(block.workspace as Blockly.WorkspaceSvg,
                new Blockly.utils.Coordinate(this.sourceBlock_.RTL ? bounds.left : bounds.right, bounds.top));

            widgetDiv.style.position = "absolute";
            widgetDiv.style.left = (this.sourceBlock_.RTL ? coord.x - 20 : coord.x + 20) + "px";
            widgetDiv.style.top = coord.y + "px";
            widgetDiv.style.width = "30rem";
            widgetDiv.style.height = "40rem";

            fv.onHide(() => {

            });

            fv.show();
        }

        render_() {
            super.render_();

            this.size_.height = TOTAL_HEIGHT;
            this.size_.width = TOTAL_WIDTH;
        }

        protected updateSiblingBlocks(sound: pxt.assets.Sound) {
            this.setNumberInputValue(this.options.durationInputName, sound.duration);
            this.setNumberInputValue(this.options.startFrequencyInputName, sound.startFrequency);
            this.setNumberInputValue(this.options.endFrequencyInputName, sound.endFrequency);
            this.setNumberInputValue(this.options.startVolumeInputName, sound.startVolume);
            this.setNumberInputValue(this.options.endVolumeInputName, sound.endVolume);
            this.setFieldDropdownValue(this.options.waveFieldName, waveformMapping[sound.wave]);
            this.setFieldDropdownValue(this.options.interpolationFieldName, interpolationMapping[sound.interpolation]);
            this.setFieldDropdownValue(this.options.effectFieldName, effectMapping[sound.effect]);
        }

        protected setNumberInputValue(name: string, value: number) {
            const block = this.getSiblingBlock(name) || this.getSiblingBlock(name, true);
            if (!block) return;

            if (block.type === "math_number" || block.type === "math_integer" || block.type === "math_whole_number") {
                block.setFieldValue(Math.round(value), "NUM");
            }
            else if (block.type === "math_number_minmax") {
                block.setFieldValue(Math.round(value), "SLIDER");
            }
        }

        protected getNumberInputValue(name: string) {
            const block = this.getSiblingBlock(name) || this.getSiblingBlock(name, true);
            if (!block) return undefined;

            if (block.type === "math_number" || block.type === "math_integer" || block.type === "math_whole_number") {
                return parseInt(block.getFieldValue("NUM") + "");
            }
            else if (block.type === "math_number_minmax") {
                return parseInt(block.getFieldValue("SLIDER") + "");
            }
            return undefined;
        }

        protected fireNumberInputUpdate(name: string, oldValue: number) {
            const block = this.getSiblingBlock(name) || this.getSiblingBlock(name, true);

            let fieldName: string
            if (block.type === "math_number" || block.type === "math_integer" || block.type === "math_whole_number") {
                fieldName = "NUM";
            }
            else if (block.type === "math_number_minmax") {
                fieldName = "SLIDER";
            }

            if (!fieldName) return;

            Blockly.Events.fire(new Blockly.Events.Change(block, "field", fieldName, oldValue, this.getNumberInputValue(name)));
        }

        protected setFieldDropdownValue(name: string, value: string) {
            const field = this.getSiblingField(name) || this.getSiblingField(name, true);
            field.setValue(value);
        }

        protected getFieldDropdownValue(name: string) {
            const field = this.getSiblingField(name) || this.getSiblingField(name, true);
            return field.getValue() as string;
        }

        protected fireFieldDropdownUpdate(name: string, oldValue: string) {
            const field = this.getSiblingField(name) || this.getSiblingField(name, true);

            if (!field) return;

            Blockly.Events.fire(new Blockly.Events.Change(field.sourceBlock_, "field", field.name, oldValue, this.getFieldDropdownValue(name)));
        }

        protected readCurrentSound(): pxt.assets.Sound {
            return {
                duration: this.getNumberInputValue(this.options.durationInputName),
                startFrequency: this.getNumberInputValue(this.options.startFrequencyInputName),
                endFrequency: this.getNumberInputValue(this.options.endFrequencyInputName),
                startVolume: this.getNumberInputValue(this.options.startVolumeInputName),
                endVolume: this.getNumberInputValue(this.options.endVolumeInputName),
                wave: Object.keys(waveformMapping).find(k => waveformMapping[k] === this.getFieldDropdownValue(this.options.waveFieldName)) as any,
                interpolation: Object.keys(interpolationMapping).find(k => interpolationMapping[k] === this.getFieldDropdownValue(this.options.interpolationFieldName)) as any,
                effect: Object.keys(effectMapping).find(k => effectMapping[k] === this.getFieldDropdownValue(this.options.effectFieldName)) as any,
            }
        }
    }

    const waveformMapping: {[index: string]: string} = {
        "sine": "WaveShape.Sine",
        "square": "WaveShape.Square",
        "sawtooth": "WaveShape.Sawtooth",
        "triangle": "WaveShape.Triangle",
        "noise": "WaveShape.Noise",
    };

    const effectMapping: {[index: string]: string} = {
        "none": "SoundExpressionEffect.None",
        "vibrato": "SoundExpressionEffect.Vibrato",
        "tremolo": "SoundExpressionEffect.Tremolo",
        "warble": "SoundExpressionEffect.Warble",
    };

    const interpolationMapping: {[index: string]: string} = {
        "linear": "InterpolationCurve.Linear",
        "curve": "InterpolationCurve.Curve",
        "logarithmic": "InterpolationCurve.Logarithmic",
    };
}