import * as Blockly from "blockly";
import { showEditorMixin } from "./fieldDropdownMixin";
import { EXPORTED_VARIABLE_TYPE, IMPORTED_VARIABLE_TYPE } from "../../blocksProgram";

import svg = pxt.svgUtil;

const ICON_WIDTH = 20;
const ICON_PADDING = 8;
const TEXT_ARROW_PADDING = 15; // Extra padding between text end and arrow

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
    private globeIcon: svg.Text;

    /**
     * Check if the current variable is a global variable (exported or imported)
     */
    protected isGlobalVariable(): boolean {
        const variable = this.getVariable();
        if (!variable) return false;
        const varType = variable.getType();
        return varType === EXPORTED_VARIABLE_TYPE || varType === IMPORTED_VARIABLE_TYPE;
    }

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

        // Add globe icon only for global variables
        if (this.isGlobalVariable()) {
            this.globeIcon = new svg.Text("\uf0ac")
                .setClass("semanticIcon")
                .setAttribute("alignment-baseline", "middle")
                .anchor("middle");
            this.fieldGroup_.appendChild(this.globeIcon.el);
        }
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

    protected override updateSize_(margin?: number): void {
        // Let parent calculate the base size first
        super.updateSize_(margin);

        // Then add extra width for the icon if we're rendering it
        if (this.globeIcon && !this.shouldAddBorderRect_()) {
            // Add space for: icon + padding between icon and text + extra padding after text for arrow
            this.size_.width += ICON_WIDTH + ICON_PADDING + TEXT_ARROW_PADDING;
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

        // Position globe icon
        if (this.globeIcon) {
            this.globeIcon.at(ICON_WIDTH / 2, this.size_.height / 2);
        }
    }

    protected override render_() {
        super.render_();

        // After parent renders, shift all children (except the icon) to make room for icon
        if (this.globeIcon && !this.shouldAddBorderRect_() && this.fieldGroup_) {
            const children = this.fieldGroup_.children;
            for (let i = 0; i < children.length; i++) {
                const child = children[i] as SVGElement;

                // Skip the globe icon itself
                if (child === this.globeIcon.el) {
                    continue;
                }

                // Shift elements with x attribute (like text)
                if (child.hasAttribute('x')) {
                    const currentX = parseFloat(child.getAttribute('x') || '0');
                    child.setAttribute('x', String(currentX + ICON_WIDTH + ICON_PADDING));
                }

                // Shift elements with transform attribute (like arrow)
                const transform = child.getAttribute('transform');
                if (transform) {
                    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
                    if (match) {
                        const x = parseFloat(match[1]);
                        const y = parseFloat(match[2]);
                        child.setAttribute('transform', `translate(${x + ICON_WIDTH + ICON_PADDING}, ${y})`);
                    }
                }
            }

            // Update the width to account for the icon and shifted elements
            this.size_.width += ICON_WIDTH + ICON_PADDING;

            // Update the click target rect to cover the new width
            if (this.clickTargetRect) {
                this.clickTargetRect.setAttribute('width', String(this.size_.width));
            }
        }
    }

    protected showEditor_(e?: MouseEvent): void {
        showEditorMixin.call(this, e);
    }

    getValue(): string | null {
        const id = super.getValue();

        // this is a workaround for to prevent blockly's flyout clearing behavior from
        // deleting recycled blocks in the flyout. by returning a fake variable name,
        // we get blockly to skip over this field's source block when it tries to delete
        // all usages of the variable
        if (this.sourceBlock_?.isInFlyout) {
            const potentialMap = this.sourceBlock_.workspace?.getPotentialVariableMap();

            if (potentialMap.getVariableById(id)) {
                return "potential_" + id;
            }
        }

        return id;
    }
}

// Override the default variable field
Blockly.fieldRegistry.unregister("field_variable");
Blockly.fieldRegistry.register("field_variable", FieldVariable);
