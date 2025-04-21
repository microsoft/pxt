import * as Blockly from "blockly";
import { showEditorMixin } from "./fieldDropdownMixin";

/**
 * This is the same as the Blockly variable field but with the addition
 * of a "New Variable" option in the dropdown
 */
export class FieldVariable extends Blockly.FieldVariable {
    static CREATE_VARIABLE_ID = "CREATE_VARIABLE";

    static dropdownCreate(this: FieldVariable): Blockly.MenuOption[] {
        const options = Blockly.FieldVariable.dropdownCreate.call(this) as Blockly.MenuOption[];

        const insertIndex = options.findIndex(e => e[1] === "RENAME_VARIABLE_ID");

        options.splice(
            insertIndex,
            0,
            [Blockly.Msg['NEW_VARIABLE_DROPDOWN'], FieldVariable.CREATE_VARIABLE_ID],
            [undefined, 'SEPARATOR']
        );

        return options;
    }

    constructor(
        varName: string | null | typeof Blockly.Field.SKIP_SETUP,
        validator?: Blockly.FieldVariableValidator,
        variableTypes?: string[],
        defaultType?: string,
        config?: Blockly.FieldVariableConfig,
    ) {
        super(varName, validator, variableTypes, defaultType, config);

        this.menuGenerator_ = FieldVariable.dropdownCreate;
    }

    protected override onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        if (this.sourceBlock_ && !this.sourceBlock_.isDeadOrDying()) {
            const id = menuItem.getValue();
            if (id === FieldVariable.CREATE_VARIABLE_ID) {
                Blockly.Variables.createVariableButtonHandler(this.sourceBlock_.workspace, name => {
                    const newVar = this.sourceBlock_.workspace.getVariableMap().getVariable(name);

                    if (newVar) {
                        this.setValue(newVar.getId());
                    }
                });
                return;
            }
        }

        super.onItemSelected_(menu, menuItem);
    }

    // Everything in this class below this line is duplicated in pxtblocks/fields/field_dropown
    // and should be kept in sync with FieldDropdown in that file
    private svgRootBinding: Blockly.browserEvents.Data | null = null;
    private fieldRootBinding: Blockly.browserEvents.Data | null = null;
    private clickTargetRect: SVGRectElement;

    override initView() {
        super.initView();

        if (this.shouldAddBorderRect_()) {
            return;
        }

        // Repurpose the border rect as a transparent click target
        this.createBorderRect_();
        this.clickTargetRect = this.borderRect_!;
        this.clickTargetRect.setAttribute("stroke-opacity", "0");
        this.clickTargetRect.setAttribute("fill-opacity", "0");

        // Make sure to unset the border rect so that it isn't included in size
        // calculations
        this.borderRect_ = undefined;
    }

    override shouldAddBorderRect_() {
        if (this.sourceBlock_.type === "variables_get") {
            return false;
        }

        // Returning false for this function will turn the entire block into
        // a click target for this field. If there are other editable fields
        // in this block, make sure we return true so that we don't make them
        // inaccessible
        for (const input of this.sourceBlock_.inputList) {
            for (const field of input.fieldRow) {
                if (field === this) continue;

                if (field.EDITABLE) {
                    return true;
                }
            }
        }
        if (!this.sourceBlock_.getInputsInline()) {
            return true;
        }
        return super.shouldAddBorderRect_();
    }

    protected override bindEvents_() {
        if (this.shouldAddBorderRect_()) {
            super.bindEvents_();
            return;
        }

        // If shouldAddBorderRect_ returns false, we want the block
        // to act as one big click target except if the block has icons
        // on it (e.g. comments, warnings, etc). In that case, we want
        // to go back to the default behavior of only respecting clicks
        // on the field itself so that we don't block clikcing on the
        // icons. To accomplish this, we register two event handlers
        // one on the sourceblock and one on the field root and check
        // the sourceblock icons to make sure only one ever runs
        this.svgRootBinding = Blockly.browserEvents.conditionalBind(
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot(),
            'pointerdown',
            this,
            (e: PointerEvent) => {
                if (this.sourceBlock_.icons.length) {
                    return;
                }
                this.onMouseDown_(e);
            },
            false
        );

        this.fieldRootBinding = Blockly.browserEvents.conditionalBind(
            this.getSvgRoot(),
            'pointerdown',
            this,
            (e: PointerEvent) => {
                if (!this.sourceBlock_.icons.length) {
                    return;
                }
                this.onMouseDown_(e);
            },
            false
        );
    }

    override dispose() {
        super.dispose();
        if (this.svgRootBinding) {
            Blockly.browserEvents.unbind(this.svgRootBinding);
            Blockly.browserEvents.unbind(this.fieldRootBinding);
        }
    }

    protected override positionBorderRect_() {
        super.positionBorderRect_();

        // The logic below is duplicated from the blockly implementation
        if (!this.clickTargetRect) {
            return;
        }
        this.clickTargetRect.setAttribute('width', String(this.size_.width));
        this.clickTargetRect.setAttribute('height', String(this.size_.height));
        this.clickTargetRect.setAttribute(
            'rx',
            String(this.getConstants()!.FIELD_BORDER_RECT_RADIUS),
        );
        this.clickTargetRect.setAttribute(
            'ry',
            String(this.getConstants()!.FIELD_BORDER_RECT_RADIUS),
        );
    }

    protected showEditor_(e?: MouseEvent): void {
        showEditorMixin.call(this, e);
    }
}

// Override the default variable field
Blockly.fieldRegistry.unregister("field_variable");
Blockly.fieldRegistry.register("field_variable", FieldVariable);
