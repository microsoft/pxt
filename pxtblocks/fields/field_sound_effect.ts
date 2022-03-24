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

            Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, () => {
                fv.hide();
            })
            const widgetDiv = Blockly.WidgetDiv.DIV as HTMLDivElement;

            const fv = pxt.react.getFieldEditorView("soundeffect-editor", this.asset, this.options, widgetDiv);

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
    }
}