/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

import svg = pxt.svgUtil;
import { FieldBase } from "./field_base";
import { FieldCustomOptions, workspaceToScreenCoordinates } from "./field_utils";

export interface FieldSoundEffectParams extends FieldCustomOptions {
    durationInputName: string;
    startFrequencyInputName: string;
    endFrequencyInputName: string;
    startVolumeInputName: string;
    endVolumeInputName: string;
    waveFieldName: string;
    interpolationFieldName: string;
    effectFieldName: string;
    useMixerSynthesizer: any;
}

const MUSIC_ICON_WIDTH = 20;
const TOTAL_WIDTH = 160;
const TOTAL_HEIGHT = 40;
const X_PADDING = 5;
const Y_PADDING = 4;
const PREVIEW_WIDTH = TOTAL_WIDTH - X_PADDING * 5 - MUSIC_ICON_WIDTH;

export class FieldSoundEffect extends FieldBase<FieldSoundEffectParams> {
    protected mostRecentValue: pxt.assets.Sound;
    protected drawnSound: pxt.assets.Sound;
    protected workspace: Blockly.Workspace;
    protected registeredChangeListener = false;

    getClass() {
        return FieldSoundEffect;
    }

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
        if (!this.options.useMixerSynthesizer) this.options.useMixerSynthesizer = false;

        this.redrawPreview();

        if (this.sourceBlock_.workspace)  {
            this.workspace = this.sourceBlock_.workspace;
            if (!this.sourceBlock_.isShadow() && !this.sourceBlock_.isInsertionMarker()) {
                this.registeredChangeListener = true;
                this.workspace.addChangeListener(this.onWorkspaceChange);
            }
        }
    }

    protected onDispose(): void {
        if (this.workspace && this.registeredChangeListener) {
            this.workspace.removeChangeListener(this.onWorkspaceChange);
            this.registeredChangeListener = false;
        }
    }

    protected onValueChanged(newValue: string): string {
        return newValue;
    }

    redrawPreview() {
        if (!this.fieldGroup_) return;

        if (this.drawnSound) {
            const current = this.readCurrentSound();
            if (current.startFrequency === this.drawnSound.startFrequency &&
                current.endFrequency === this.drawnSound.endFrequency &&
                current.startVolume === this.drawnSound.startVolume &&
                current.endVolume === this.drawnSound.endVolume &&
                current.wave === this.drawnSound.wave &&
                current.interpolation === this.drawnSound.interpolation
            ) {
                return;
            }
        }

        pxsim.U.clear(this.fieldGroup_);
        const bg = new svg.Rect()
            .at(X_PADDING, Y_PADDING)
            .size(TOTAL_WIDTH, TOTAL_HEIGHT)
            .setClass("blocklySpriteField")
            .stroke("#fff", 1)
            .fill("#dedede")
            .corner(TOTAL_HEIGHT / 2);

        const clipPathId = "preview-clip-" + pxt.U.guidGen();

        const clip = new svg.ClipPath()
            .id(clipPathId)
            .clipPathUnits(false)

        const clipRect = new svg.Rect()
            .size(PREVIEW_WIDTH, TOTAL_HEIGHT)
            .fill("#FFF")
            .at(0, 0);

        clip.appendChild(clipRect);

        this.drawnSound = this.readCurrentSound();
        const path = new svg.Path()
            .stroke("grey", 2)
            .fill("none")
            .setD(pxt.assets.renderSoundPath(this.drawnSound, TOTAL_WIDTH - X_PADDING * 4 - MUSIC_ICON_WIDTH, TOTAL_HEIGHT - Y_PADDING * 2))
            .clipPath("url('#" + clipPathId + "')")


        const g = new svg.Group()
            .translate(MUSIC_ICON_WIDTH + X_PADDING * 3, Y_PADDING + 3);

        g.appendChild(clip);
        g.appendChild(path);

        const musicIcon = new svg.Text("\uf001")
            .appendClass("melody-editor-field-icon")
            .setAttribute("alignment-baseline", "middle")
            .anchor("middle")
            .at(X_PADDING * 2 + MUSIC_ICON_WIDTH / 2, TOTAL_HEIGHT / 2 + 4);

        this.fieldGroup_.appendChild(bg.el);
        this.fieldGroup_.appendChild(musicIcon.el);
        this.fieldGroup_.appendChild(g.el);
    }

    showEditor_() {
        const initialSound = this.readCurrentSound();
        Blockly.Events.disable();

        let bbox: Blockly.utils.Rect;

        // This is due to the changes in https://github.com/microsoft/pxt-blockly/pull/289
        // which caused the widgetdiv to jump around if any fields underneath changed size
        let widgetOwner = {
            getScaledBBox: () => bbox
        }

        Blockly.WidgetDiv.show(widgetOwner, this.sourceBlock_.RTL, () => {
            if (document.activeElement && document.activeElement.tagName === "INPUT") (document.activeElement as HTMLInputElement).blur();

            fv.hide();

            widgetDiv.classList.remove("sound-effect-editor-widget");
            widgetDiv.style.transform = "";
            widgetDiv.style.position = "";
            widgetDiv.style.left = "";
            widgetDiv.style.top = "";
            widgetDiv.style.width = "";
            widgetDiv.style.height = "";
            widgetDiv.style.opacity = "";
            widgetDiv.style.transition = "";
            widgetDiv.style.alignItems = "";

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

            if (this.mostRecentValue) this.setBlockData(JSON.stringify(this.mostRecentValue))
        })

        const widgetDiv = Blockly.WidgetDiv.getDiv();
        const opts = {
            onClose: () => {
                fv.hide();
                Blockly.WidgetDiv.hideIfOwner(widgetOwner);
            },
            onSoundChange: (newSound: pxt.assets.Sound) => {
                this.mostRecentValue = newSound;
                this.updateSiblingBlocks(newSound);
                this.redrawPreview();
            },
            initialSound: initialSound,
            useMixerSynthesizer: isTrue(this.options.useMixerSynthesizer)
        }

        const fv = pxt.react.getFieldEditorView("soundeffect-editor", initialSound, opts, widgetDiv);

        const block = this.sourceBlock_ as Blockly.BlockSvg;
        const bounds = block.getBoundingRectangle();
        const coord = workspaceToScreenCoordinates(block.workspace as Blockly.WorkspaceSvg,
            new Blockly.utils.Coordinate(bounds.right, bounds.top));

        const animationDistance = 20;

        const left = coord.x + 20;
        const top = coord.y - animationDistance;
        widgetDiv.style.opacity = "0";
        widgetDiv.classList.add("sound-effect-editor-widget");
        widgetDiv.style.position = "absolute";
        widgetDiv.style.left = left + "px";
        widgetDiv.style.top = top + "px";
        widgetDiv.style.width = "30rem";
        widgetDiv.style.height = "40rem";
        widgetDiv.style.display = "flex";
        widgetDiv.style.alignItems = "center";
        widgetDiv.style.transition = "transform 0.25s ease 0s, opacity 0.25s ease 0s";
        widgetDiv.style.borderRadius = "";

        fv.onHide(() => {
            // do nothing
        });

        fv.show();

        const divBounds = widgetDiv.getBoundingClientRect();
        const injectDivBounds = block.workspace.getInjectionDiv().getBoundingClientRect();

        if (divBounds.height > injectDivBounds.height) {
            widgetDiv.style.height = "";
            widgetDiv.style.top = `calc(1rem - ${animationDistance}px)`;
            widgetDiv.style.bottom = `calc(1rem + ${animationDistance}px)`;
        }
        else {
            if (divBounds.bottom > injectDivBounds.bottom || divBounds.top < injectDivBounds.top) {
                // This editor is pretty tall, so just center vertically on the inject div
                widgetDiv.style.top = (injectDivBounds.top + (injectDivBounds.height / 2) - (divBounds.height / 2)) - animationDistance + "px";
            }
        }

        const toolboxWidth = block.workspace.getToolbox().getWidth();

        if (divBounds.width > injectDivBounds.width - toolboxWidth) {
            widgetDiv.style.width = "";
            widgetDiv.style.left = "1rem";
            widgetDiv.style.right = "1rem";
        }
        else {
            // Check to see if we are bleeding off the right side of the canvas
            if (divBounds.left + divBounds.width >= injectDivBounds.right) {
                // If so, try and place to the left of the block instead of the right
                const blockLeft = workspaceToScreenCoordinates(block.workspace as Blockly.WorkspaceSvg,
                    new Blockly.utils.Coordinate(bounds.left, bounds.top));

                const workspaceLeft = injectDivBounds.left + toolboxWidth;

                if (blockLeft.x - divBounds.width - 20 > workspaceLeft) {
                    widgetDiv.style.left = (blockLeft.x - divBounds.width - 20) + "px"
                }
                else {
                    // As a last resort, just center on the inject div
                    widgetDiv.style.left = (workspaceLeft + ((injectDivBounds.width - toolboxWidth) / 2) - divBounds.width / 2) + "px";
                }
            }
        }

        const finalDimensions = widgetDiv.getBoundingClientRect();
        bbox = new Blockly.utils.Rect(finalDimensions.top, finalDimensions.bottom, finalDimensions.left, finalDimensions.right);

        requestAnimationFrame(() => {
            widgetDiv.style.opacity = "1";
            widgetDiv.style.transform = `translateY(${animationDistance}px)`;
        })
    }

    render_() {
        super.render_();

        this.size_.height = TOTAL_HEIGHT + Y_PADDING * 2;
        this.size_.width = TOTAL_WIDTH + X_PADDING;
    }

    getFieldDescription(): string {
        return lf("sound effect");
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

    protected getNumberInputValue(name: string, defaultValue: number) {
        const block = this.getSiblingBlock(name) || this.getSiblingBlock(name, true);
        if (!block) return defaultValue;

        if (block.type === "math_number" || block.type === "math_integer" || block.type === "math_whole_number") {
            return parseInt(block.getFieldValue("NUM") + "");
        }
        else if (block.type === "math_number_minmax") {
            return parseInt(block.getFieldValue("SLIDER") + "");
        }
        return defaultValue;
    }

    protected fireNumberInputUpdate(name: string, oldValue: number) {
        const block = this.getSiblingBlock(name) || this.getSiblingBlock(name, true);

        if (!block) return;

        let fieldName: string
        if (block.type === "math_number" || block.type === "math_integer" || block.type === "math_whole_number") {
            fieldName = "NUM";
        }
        else if (block.type === "math_number_minmax") {
            fieldName = "SLIDER";
        }

        if (!fieldName) return;

        Blockly.Events.fire(new Blockly.Events.BlockChange(block, "field", fieldName, oldValue, this.getNumberInputValue(name, oldValue)));
    }

    protected setFieldDropdownValue(name: string, value: string) {
        const field = this.getSiblingField(name) || this.getSiblingField(name, true);
        if (!field) return;
        field.setValue(value);
    }

    protected getFieldDropdownValue(name: string) {
        const field = this.getSiblingField(name) || this.getSiblingField(name, true);
        if (!field) return undefined;
        return field.getValue() as string;
    }

    protected fireFieldDropdownUpdate(name: string, oldValue: string) {
        const field = this.getSiblingField(name) || this.getSiblingField(name, true);

        if (!field) return;

        Blockly.Events.fire(new Blockly.Events.BlockChange(field.getSourceBlock(), "field", field.name, oldValue, this.getFieldDropdownValue(name)));
    }

    protected readCurrentSound(): pxt.assets.Sound {
        const savedSound = this.readBlockDataSound();
        return {
            duration: this.getNumberInputValue(this.options.durationInputName, savedSound.duration),
            startFrequency: this.getNumberInputValue(this.options.startFrequencyInputName, savedSound.startFrequency),
            endFrequency: this.getNumberInputValue(this.options.endFrequencyInputName, savedSound.endFrequency),
            startVolume: this.getNumberInputValue(this.options.startVolumeInputName, savedSound.startVolume),
            endVolume: this.getNumberInputValue(this.options.endVolumeInputName, savedSound.endVolume),
            wave: reverseLookup(waveformMapping, this.getFieldDropdownValue(this.options.waveFieldName)) as any || savedSound.wave,
            interpolation: reverseLookup(interpolationMapping, this.getFieldDropdownValue(this.options.interpolationFieldName)) as any || savedSound.interpolation,
            effect: reverseLookup(effectMapping, this.getFieldDropdownValue(this.options.effectFieldName)) as any || savedSound.effect,
        }
    }

    // This stores the values of the fields in case a block (e.g. a variable) is placed in one
    // of the inputs.
    protected readBlockDataSound(): pxt.assets.Sound {
        const data = this.getBlockData();
        let sound: pxt.assets.Sound;

        try {
            sound = JSON.parse(data);
        }
        catch (e) {
            sound = {
                duration: 1000,
                startFrequency: 100,
                endFrequency: 4800,
                startVolume: 100,
                endVolume: 0,
                wave: "sine",
                interpolation: "linear",
                effect: "none"
            }
        }

        return sound;
    }

    protected onWorkspaceChange = (ev: Blockly.Events.BlockChange) => {
        if (ev.type !== Blockly.Events.CHANGE) return;

        const block = this.sourceBlock_.workspace.getBlockById(ev.blockId);
        if (!block || block !== this.sourceBlock_ && block.getParent() !== this.sourceBlock_) return;

        this.redrawPreview();
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

function reverseLookup(map: {[index: string]: string}, value: string) {
    return Object.keys(map).find(k => map[k] === value);
}

function isTrue(value: any) {
    if (!value) return false;

    if (typeof value === "string") {
        switch (value.toLowerCase().trim()) {
            case "1":
            case "yes":
            case "y":
            case "on":
            case "true":
                return true;
            default:
                return false;
        }
    }

    return !!value;
}