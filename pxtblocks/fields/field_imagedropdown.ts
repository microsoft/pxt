/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { clearDropDownDiv, FieldCustom, FieldCustomDropdownOptions, parseColour } from "./field_utils";
import { FieldDropdown } from "./field_dropdown";

export interface FieldImageDropdownOptions extends FieldCustomDropdownOptions {
    columns?: string;
    maxRows?: string;
    width?: string;
}

type ButtonRow = {
    height: number;
    width: number;
    items: Blockly.MenuOption[];
}

export class FieldImageDropdown extends FieldDropdown implements FieldCustom {
    public isFieldCustom_ = true;
    // Width in pixels
    protected width_: number;

    // Columns in grid
    protected columns_: number;

    // Number of rows to display (if there are extra rows, the picker will be scrollable)
    protected maxRows_: number;

    protected backgroundColour_: string;
    protected borderColour_: string;

    protected savedPrimary_: string;

    constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
        super(options.data);

        this.columns_ = parseInt(options.columns);
        this.maxRows_ = parseInt(options.maxRows) || 0;
        this.width_ = parseInt(options.width) || 300;

        this.backgroundColour_ = parseColour(options.colour);
        this.borderColour_ = pxt.toolbox.fadeColor(this.backgroundColour_, 0.4, false);
    }

    /**
     * Create a dropdown menu under the text.
     * @private
     */
    public showEditor_() {
        // If there is an existing drop-down we own, this is a request to hide the drop-down.
        if (Blockly.DropDownDiv.hideIfOwner(this)) {
            return;
        }
        // If there is an existing drop-down someone else owns, hide it immediately and clear it.
        Blockly.DropDownDiv.hideWithoutAnimation();
        clearDropDownDiv();
        // Populate the drop-down with the icons for this field.
        let dropdownDiv = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        let contentDiv = document.createElement('div');
        // Accessibility properties
        contentDiv.setAttribute('role', 'menu');
        contentDiv.setAttribute('aria-haspopup', 'true');
        contentDiv.classList.add("blocklyMenu", "blocklyDropdownMenu");

        const rows: ButtonRow[] = [];
        let currentRow: ButtonRow = {
            height: 0,
            width: 0,
            items: [],
        };

        const BUTTON_MARGIN = 8;

        const options = this.getOptions();

        const columnButtonSize = this.columns_ ? ((this.width_ / this.columns_) - BUTTON_MARGIN) : 0;

        // do a first pass to calculate the rows
        for (let i = 0; i < options.length; i++) {
            const content = (options[i] as any)[0];

            let buttonWidth = content.width;
            let buttonHeight = content.height;

            if (content.type != "placeholder" && this.columns_) {
                buttonWidth = columnButtonSize;
                buttonHeight = columnButtonSize;
            }

            if (currentRow.height && (currentRow.width + buttonWidth + BUTTON_MARGIN > this.width_)) {
                rows.push(currentRow);
                currentRow = {
                    width: buttonWidth + BUTTON_MARGIN,
                    height: buttonHeight + BUTTON_MARGIN,
                    items: [options[i]]
                };
            }
            else {
                currentRow.width += buttonWidth + BUTTON_MARGIN;
                currentRow.height = Math.max(currentRow.height, buttonHeight + BUTTON_MARGIN);
                currentRow.items.push(options[i]);
            }
        }

        rows.push(currentRow);

        // now create the actual row elements
        let descendantIndex = 0;
        for (const row of rows) {
            const rowDiv = document.createElement("div");
            rowDiv.style.width = row.width + "px";
            rowDiv.style.height = row.height + "px";
            contentDiv.appendChild(rowDiv);
            for (const option of row.items) {
                let content = (option as any)[0]; // Human-readable text or image.
                const value = (option as any)[1]; // Language-neutral value.
                // Icons with the type property placeholder take up space but don't have any functionality
                // Use for special-case layouts
                if (content.type == 'placeholder') {
                    let placeholder = document.createElement('span');
                    placeholder.setAttribute('class', 'blocklyDropDownPlaceholder');
                    placeholder.style.width = content.width + 'px';
                    placeholder.style.height = row.height + 'px';
                    rowDiv.appendChild(placeholder);
                    continue;
                }

                const button = document.createElement('button');
                button.setAttribute('id', ':' + descendantIndex++); // For aria-activedescendant
                button.setAttribute('role', 'menuitem');
                button.setAttribute('class', 'blocklyDropDownButton');
                button.title = content.alt;

                button.style.width = (columnButtonSize || content.width) + 'px';
                button.style.height = (columnButtonSize || content.height) + 'px';

                let backgroundColor = this.backgroundColour_;
                if (value == this.getValue()) {
                    // This icon is selected, show it in a different colour
                    backgroundColor = (this.sourceBlock_ as Blockly.BlockSvg).getColourTertiary();
                    button.setAttribute('aria-selected', 'true');
                }
                button.style.backgroundColor = backgroundColor;
                button.style.borderColor = this.borderColour_;
                Blockly.browserEvents.bind(button, 'click', this, this.buttonClick_);
                Blockly.browserEvents.bind(button, 'mouseover', this, () => {
                    button.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                    contentDiv.setAttribute('aria-activedescendant', button.id);
                });
                Blockly.browserEvents.bind(button, 'mouseout', this, () => {
                    button.setAttribute('class', 'blocklyDropDownButton');
                    contentDiv.removeAttribute('aria-activedescendant');
                });
                let buttonImg = document.createElement('img');
                buttonImg.src = content.src;
                //buttonImg.alt = icon.alt;
                // Upon click/touch, we will be able to get the clicked element as e.target
                // Store a data attribute on all possible click targets so we can match it to the icon.
                button.setAttribute('data-value', value);
                buttonImg.setAttribute('data-value', value);
                button.appendChild(buttonImg);
                rowDiv.appendChild(button);
            }
        }

        dropdownDiv.appendChild(contentDiv);
        if (this.maxRows_) {
            // Limit the number of rows shown, but add a partial next row to indicate scrolling
            const totalHeight = sumRowHeight(rows);
            let maxHeight = sumRowHeight(rows.slice(0, this.maxRows_));

            if (rows.length > this.maxRows_) {
                maxHeight += 0.4 * (rows[this.maxRows_].height)
            }
            dropdownDiv.style.maxHeight = maxHeight + 'px';
            dropdownDiv.style.height = totalHeight + 'px';
        }

        if (pxt.BrowserUtils.isFirefox()) {
            // This is to compensate for the scrollbar that overlays content in Firefox. It
            // gets removed in onHide_()
            dropdownDiv.style.paddingRight = "20px";
        }

        Blockly.DropDownDiv.setColour(this.backgroundColour_, this.borderColour_);

        Blockly.DropDownDiv.showPositionedByField(this, this.onHide_.bind(this));

        let source = this.sourceBlock_ as Blockly.BlockSvg;
        this.savedPrimary_ = source?.getColour();
        if (source?.isShadow()) {
            source.setColour(source.getColourTertiary());
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', source.getColourTertiary());
        }
    }

    doValueUpdate_(newValue: any): void {
        (this as any).selectedOption_ = undefined;
        super.doValueUpdate_(newValue);
    }

    getFieldDescription(): string {
        return lf("image");
    }

    /**
     * Callback for when a button is clicked inside the drop-down.
     * Should be bound to the FieldIconMenu.
     * @param {Event} e DOM event for the click/touch
     * @private
     */
    protected buttonClick_ = (e: MouseEvent) => {
        let value = (e.target as Element).getAttribute('data-value');
        if (!value) return;
        this.setValue(value);
        Blockly.DropDownDiv.hide();
    };

    /**
     * Callback for when the drop-down is hidden.
     */
    protected onHide_() {
        let content = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        content.removeAttribute('role');
        content.removeAttribute('aria-haspopup');
        content.removeAttribute('aria-activedescendant');
        content.style.width = '';
        content.style.paddingRight = '';
        content.style.maxHeight = '';

        let source = this.sourceBlock_ as Blockly.BlockSvg;
        if (source?.isShadow()) {
            this.sourceBlock_.setColour(this.savedPrimary_);
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', this.savedPrimary_);
        }
    };
}

function sumRowHeight(arr: ButtonRow[]) {
    return arr.reduce((accumulator, current) => accumulator + current.height, 0);
}

Blockly.Css.register(`
.blocklyDropDownButton {
    display: inline-block;
    float: left;
    padding: 0;
    margin: 4px;
    border-radius: 4px;
    outline: none;
    border: 1px solid;
    transition: box-shadow .1s;
    cursor: pointer;
}

.blocklyDropDownButtonHover {
    box-shadow: 0px 0px 0px 4px rgba(255, 255, 255, 0.2);
}

.blocklyDropDownButton:active {
    box-shadow: 0px 0px 0px 6px rgba(255, 255, 255, 0.2);
}

.blocklyDropDownButton > img {
    width: 80%;
    height: 80%;
    margin-top: 5%
}
`)