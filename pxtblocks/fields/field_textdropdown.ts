/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomOptions } from "./field_utils";

export interface FieldTextDropdownOptions extends FieldCustomOptions {
    values: any;
}

export class BaseFieldTextDropdown extends Blockly.FieldTextInput {
    static DROPDOWN_SVG_DATAURI = 'data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMi43MSIgaGVpZ2h0PSI4Ljc5IiB2aWV3Qm94PSIwIDAgMTIuNzEgOC43OSI+PHRpdGxlPmRyb3Bkb3duLWFycm93PC90aXRsZT48ZyBvcGFjaXR5PSIwLjEiPjxwYXRoIGQ9Ik0xMi43MSwyLjQ0QTIuNDEsMi40MSwwLDAsMSwxMiw0LjE2TDguMDgsOC4wOGEyLjQ1LDIuNDUsMCwwLDEtMy40NSwwTDAuNzIsNC4xNkEyLjQyLDIuNDIsMCwwLDEsMCwyLjQ0LDIuNDgsMi40OCwwLDAsMSwuNzEuNzFDMSwwLjQ3LDEuNDMsMCw2LjM2LDBTMTEuNzUsMC40NiwxMiwuNzFBMi40NCwyLjQ0LDAsMCwxLDEyLjcxLDIuNDRaIiBmaWxsPSIjMjMxZjIwIi8+PC9nPjxwYXRoIGQ9Ik02LjM2LDcuNzlhMS40MywxLjQzLDAsMCwxLTEtLjQyTDEuNDIsMy40NWExLjQ0LDEuNDQsMCwwLDEsMC0yYzAuNTYtLjU2LDkuMzEtMC41Niw5Ljg3LDBhMS40NCwxLjQ0LDAsMCwxLDAsMkw3LjM3LDcuMzdBMS40MywxLjQzLDAsMCwxLDYuMzYsNy43OVoiIGZpbGw9IiM1NzVFNzUiLz48L3N2Zz4K';

    /** A reference to the currently selected menu item. */
    private selectedMenuItem: Blockly.MenuItem | null = null;

    /** The dropdown menu. */
    protected menu_: Blockly.Menu | null = null;

    /** SVG based arrow element. */
    private svgArrow: SVGElement | null = null;

    /** A cache of the most recently generated options. */
    private generatedOptions: Blockly.MenuOption[] | null = null;

    protected dropDownOpen_: boolean;

    constructor(text: string, protected menuGenerator_: any[], opt_validator?: Blockly.FieldValidator) {
        super(text, opt_validator);
    }

    initView(): void {
        super.initView();
        this.createSVGArrow();
    }

    protected showEditor_(e?: Event, quietInput?: boolean): void {
        super.showEditor_(e, quietInput);

        if (!this.dropDownOpen_) this.showDropdown_();
        Blockly.Touch.clearTouchIdentifier();
    }

    getOptions(useCache?: boolean): Blockly.MenuOption[] {
        if (!this.menuGenerator_) {
            // A subclass improperly skipped setup without defining the menu
            // generator.
            throw TypeError('A menu generator was never defined.');
        }
        if (Array.isArray(this.menuGenerator_)) return this.menuGenerator_;
        if (useCache && this.generatedOptions) return this.generatedOptions;

        validateOptions(this.generatedOptions);
        return this.generatedOptions;
    }

    isOptionListDynamic(): boolean {
        return typeof this.menuGenerator_ === 'function';
    }

    protected dropdownDispose_() {
        this.dropDownOpen_ = false;
        if (this.menu_) {
            this.menu_.dispose();
        }
        this.menu_ = null;
        this.selectedMenuItem = null;
        this.applyColour();
    }

    private dropdownCreate() {
        const block = this.getSourceBlock();
        if (!block) {
            throw new Blockly.UnattachedFieldError();
        }
        const menu = new Blockly.Menu();
        menu.setRole(Blockly.utils.aria.Role.LISTBOX);
        this.menu_ = menu;

        const options = this.getOptions(false);
        this.selectedMenuItem = null;
        for (let i = 0; i < options.length; i++) {
            const [label, value] = options[i];
            const content = (() => {
                if (typeof label === 'object') {
                    // Convert ImageProperties to an HTMLImageElement.
                    const image = new Image(label['width'], label['height']);
                    image.src = label['src'];
                    image.alt = label['alt'] || '';
                    return image;
                }
                return label;
            })();
            const menuItem = new Blockly.MenuItem(content, value);
            menuItem.setRole(Blockly.utils.aria.Role.OPTION);
            menuItem.setRightToLeft(block.RTL);
            menuItem.setCheckable(true);
            menu.addChild(menuItem);
            menuItem.setChecked(value === this.value_);
            if (value === this.value_) {
                this.selectedMenuItem = menuItem;
            }
            menuItem.onAction(this.handleMenuActionEvent, this);
        }
    }

    showDropdown_(e?: MouseEvent) {
        const block = this.getSourceBlock() as Blockly.BlockSvg;
        if (!block) {
            throw new Blockly.UnattachedFieldError();
        }
        this.dropdownCreate();
        if (e && typeof e.clientX === 'number') {
            this.menu_!.openingCoords = new Blockly.utils.Coordinate(e.clientX, e.clientY);
        } else {
            this.menu_!.openingCoords = null;
        }

        // Remove any pre-existing elements in the dropdown.
        Blockly.DropDownDiv.clearContent();
        // Element gets created in render.
        const menuElement = this.menu_!.render(Blockly.DropDownDiv.getContentDiv());
        Blockly.utils.dom.addClass(menuElement, 'blocklyDropdownMenu');

        const parent = block.getParent() as Blockly.BlockSvg;

        const primaryColour = (parent || block).getColour();
        const borderColour = (parent || block).style.colourTertiary;
        Blockly.DropDownDiv.setColour(primaryColour, borderColour);

        this.dropDownOpen_ = true;

        Blockly.DropDownDiv.showPositionedByField(this, this.dropdownDispose_.bind(this));

        // Focusing needs to be handled after the menu is rendered and positioned.
        // Otherwise it will cause a page scroll to get the misplaced menu in
        // view. See issue #1329.
        // this.menu_!.focus();

        if (this.selectedMenuItem) {
            this.menu_!.setHighlighted(this.selectedMenuItem);
            Blockly.utils.style.scrollIntoContainerView(
                this.selectedMenuItem.getElement()!,
                Blockly.DropDownDiv.getContentDiv(),
                true,
            );
        }

        this.applyColour();
    }

    protected updateSize_(margin?: number): void {
        super.updateSize_(margin);

        const arrowWidth = this.positionSVGArrow(this.size_.width,
            this.size_.height / 2 -
            this.getConstants().FIELD_DROPDOWN_SVG_ARROW_SIZE / 2);

        if (this.sourceBlock_.RTL && this.textElement_) {
            const constants = this.getConstants();
            const contentWidth = Blockly.utils.dom.getFastTextWidth(
                this.textElement_,
                constants!.FIELD_TEXT_FONTSIZE,
                constants!.FIELD_TEXT_FONTWEIGHT,
                constants!.FIELD_TEXT_FONTFAMILY,
              );
            this.positionTextElement_(-arrowWidth, contentWidth)
        }

        this.size_.width += arrowWidth;
    }

    private positionSVGArrow(x: number, y: number): number {
        if (!this.svgArrow) {
            return 0;
        }
        const block = this.getSourceBlock();
        if (!block) {
            throw new Blockly.UnattachedFieldError();
        }
        const hasBorder = !!this.borderRect_;
        const xPadding = hasBorder
            ? this.getConstants()!.FIELD_BORDER_RECT_X_PADDING
            : 0;
        const textPadding = this.getConstants()!.FIELD_DROPDOWN_SVG_ARROW_PADDING;
        const svgArrowSize = this.getConstants()!.FIELD_DROPDOWN_SVG_ARROW_SIZE;
        const arrowX = block.RTL ? (xPadding / 2) : x + textPadding;
        this.svgArrow.setAttribute(
            'transform',
            'translate(' + arrowX + ',' + y + ')',
        );
        return svgArrowSize + textPadding;
    }

    protected createSVGArrow() {
        this.svgArrow = Blockly.utils.dom.createSvgElement('image', {
            'height': this.getConstants().FIELD_DROPDOWN_SVG_ARROW_SIZE + 'px',
            'width': this.getConstants().FIELD_DROPDOWN_SVG_ARROW_SIZE + 'px'
        }, this.fieldGroup_);
        this.svgArrow.setAttributeNS(Blockly.utils.dom.XLINK_NS, 'xlink:href',
            FieldTextDropdown.DROPDOWN_SVG_DATAURI);
    }

    private handleMenuActionEvent(menuItem: Blockly.MenuItem) {
        Blockly.DropDownDiv.hideIfOwner(this, true);
        this.onItemSelected_(this.menu_ as Blockly.Menu, menuItem);
    }

    protected onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        this.setValue(menuItem.getValue());

        Blockly.WidgetDiv.hideIfOwner(this);
    }
}

function validateOptions(options: Blockly.MenuOption[]) {
    if (!Array.isArray(options)) {
        throw TypeError('FieldDropdown options must be an array.');
    }
    if (!options.length) {
        throw TypeError('FieldDropdown options must not be an empty array.');
    }
    let foundError = false;
    for (let i = 0; i < options.length; i++) {
        const tuple = options[i];
        if (!Array.isArray(tuple)) {
            foundError = true;
            console.error(
                'Invalid option[' +
                i +
                ']: Each FieldDropdown option must be an ' +
                'array. Found: ',
                tuple,
            );
        } else if (typeof tuple[1] !== 'string') {
            foundError = true;
            console.error(
                'Invalid option[' +
                i +
                ']: Each FieldDropdown option id must be ' +
                'a string. Found ' +
                tuple[1] +
                ' in: ',
                tuple,
            );
        } else if (
            tuple[0] &&
            typeof tuple[0] !== 'string' &&
            typeof tuple[0].src !== 'string'
        ) {
            foundError = true;
            console.error(
                'Invalid option[' +
                i +
                ']: Each FieldDropdown option must have a ' +
                'string label or image description. Found' +
                tuple[0] +
                ' in: ',
                tuple,
            );
        }
    }
    if (foundError) {
        throw TypeError('Found invalid FieldDropdown options.');
    }
}

export class FieldTextDropdown extends BaseFieldTextDropdown implements FieldCustom {
    public isFieldCustom_ = true;

    constructor(text: string, options: FieldTextDropdownOptions, opt_validator?: Blockly.FieldValidator) {
        super(text, options.values, opt_validator);
    }
}