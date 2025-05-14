/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { clearDropDownDiv, FieldCustom, FieldCustomDropdownOptions, parseColour } from "./field_utils";
import { FieldDropdownGrid } from "./field_dropdowngrid";

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

export class FieldImageDropdown extends FieldDropdownGrid implements FieldCustom {
    protected savedPrimary_: string;

    constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
        super(options.data);

        this.columns_ = parseInt(options.columns);
        this.maxRows_ = parseInt(options.maxRows) || 0;
        this.width_ = parseInt(options.width) || 300;

        this.backgroundColour_ = parseColour(options.colour);
        this.borderColour_ = pxt.toolbox.fadeColor(this.backgroundColour_, 0.4, false);
    }

    protected setFocusedItem_(gridItemContainer: HTMLElement) {
        this.gridItems.forEach(button => button.setAttribute('class', 'blocklyDropDownButton'));
        const activeButton = this.gridItems[this.activeDescendantIndex];
        const activeButtonContainer = activeButton.parentElement;
        activeButton.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonFocus');
        const activeButtonRect = activeButtonContainer.getBoundingClientRect();
        // Has to be the parent element as the gridItems in the gridItemContainer are all floated.
        const containerRect = gridItemContainer.parentElement.getBoundingClientRect();
        if (activeButtonRect.bottom > containerRect.bottom) {
            activeButtonContainer.scrollIntoView({block: "end"});
        } else if (activeButtonRect.top < containerRect.top) {
            activeButtonContainer.scrollIntoView({block: "start"});
        }
    }

    protected createRow() {
        const row = document.createElement('div');
        row.setAttribute('role', 'row');
        return row;
    }

    /**
     * Create a dropdown menu under the text.
     * @private
     */
    public showEditor_(e?: Event) {
        this.setOpeningPointerCoords(e);
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
        contentDiv.setAttribute('role', 'grid');
        contentDiv.setAttribute('tabindex', '0');
        contentDiv.classList.add("blocklyMenu", "blocklyDropdownMenu");

        this.addPointerListener(dropdownDiv);
        this.addKeyDownHandler(contentDiv);

        const rows: ButtonRow[] = [];
        let currentRow: ButtonRow = {
            height: 0,
            width: 0,
            items: [],
        };

        const BUTTON_MARGIN = 8;

        const options = this.getOptions();

        const columnButtonWidth = this.columns_ ? ((this.width_ / this.columns_) - BUTTON_MARGIN) : 0;

        // do a first pass to calculate the rows
        let selectedButtonContainer;
        let row = this.createRow();
        for (let i = 0; i < options.length; i++) {
            const content = (options[i] as any)[0];

            let buttonWidth = content.width;
            let buttonHeight = content.height;

            if (content.type != "placeholder" && this.columns_) {
                buttonWidth = columnButtonWidth;
                buttonHeight = columnButtonWidth;
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
            const rowDiv = this.createRow();
            rowDiv.style.width = row.width + "px";
            rowDiv.style.height = row.height + "px";
            contentDiv.appendChild(rowDiv);
            for (const option of row.items) {
                const localDescendantIndex = descendantIndex;
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

                const buttonContainer = document.createElement('div');
                buttonContainer.setAttribute('class', 'blocklyDropDownButtonContainer')
                const button = document.createElement('div');
                button.setAttribute('id', ':' + localDescendantIndex); // For aria-activedescendant
                button.setAttribute('role', 'gridcell');
                button.setAttribute('aria-selected', 'false');
                button.classList.add('blocklyDropDownButton');
                button.title = content.alt;

                button.style.width = (columnButtonWidth || content.width) + 'px';
                button.style.height = row.height + 'px';

                let backgroundColor = this.backgroundColour_;
                if (value == this.getValue()) {
                    // This icon is selected, show it in a different colour
                    backgroundColor = (this.sourceBlock_ as Blockly.BlockSvg).getColourTertiary();
                    button.setAttribute('aria-selected', 'true');
                    this.activeDescendantIndex = localDescendantIndex;
                    contentDiv.setAttribute('aria-activedescendant', button.id);
                    button.setAttribute('class', `blocklyDropDownButton ${this.openingPointerCoords ? "blocklyDropDownButtonHover" : "blocklyDropDownButtonFocus"}`);
                    selectedButtonContainer = buttonContainer;
                }
                button.style.backgroundColor = backgroundColor;
                button.style.borderColor = this.borderColour_;
                Blockly.browserEvents.bind(button, 'click', this, () => this.buttonClickAndClose_(value));
                Blockly.browserEvents.bind(button, 'pointermove', this, () => {
                    if (this.pointerMoveTriggeredByUser()) {
                        this.gridItems.forEach(button => button.setAttribute('class', 'blocklyDropDownButton'));
                        this.activeDescendantIndex = localDescendantIndex;
                        button.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                        contentDiv.setAttribute('aria-activedescendant', button.id);
                    }
                });
                Blockly.browserEvents.bind(button, 'pointerout', this, () => {
                    if (this.pointerOutTriggeredByUser()) {
                        button.setAttribute('class', 'blocklyDropDownButton');
                        contentDiv.removeAttribute('aria-activedescendant');
                        this.activeDescendantIndex = undefined;
                    }
                });
                let buttonImg = document.createElement('img');
                buttonImg.src = content.src;
                //buttonImg.alt = icon.alt;
                // Upon click/touch, we will be able to get the clicked element as e.target
                // Store a data attribute on all possible click targets so we can match it to the icon.
                button.setAttribute('data-value', value);
                buttonImg.setAttribute('data-value', value);
                button.appendChild(buttonImg);
                this.gridItems.push(button);
                buttonContainer.appendChild(button);
                rowDiv.append(buttonContainer);
                descendantIndex++;
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

        contentDiv.focus();

        if (selectedButtonContainer) {
            selectedButtonContainer.scrollIntoView({block: "end"});
        }

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

    protected buttonClickAndClose_ = (value: string | null) => {
        if (!value) return;
        this.setValue(value);
        Blockly.DropDownDiv.hide();
    };

    /**
     * Callback for when the drop-down is hidden.
     */
    protected onHide_() {
        this.disposeGrid();
        let content = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        content.removeAttribute('role');
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
.blocklyDropDownButtonContainer,
.blocklyDropDownButton {
    display: inline-block;
    float: left;
    border-radius: 4px;
    text-align: center;
    margin: 0;
}

.blocklyDropDownButtonContainer {
    padding: 4px;
}

.blocklyDropDownButton {
    border: 1px solid;
    transition: box-shadow .1s;
    cursor: pointer;
    outline: none;
}

.blocklyDropDownButtonHover {
    box-shadow: 0px 0px 0px 4px rgba(255, 255, 255, 0.2);
}

.blocklyDropDownButtonFocus {
    box-shadow: 0px 0px 0px 4px rgb(255, 255, 255);
}

.blocklyDropDownButton:active {
    box-shadow: 0px 0px 0px 6px rgba(255, 255, 255, 0.2);
}

.blocklyDropDownButton > img {
    width: 80%;
    height: 80%;
    position: relative;
    top: 50%;
    transform: translateY(-50%);
}
`)