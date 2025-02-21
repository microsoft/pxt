/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomDropdownOptions, parseColour } from "./field_utils";
import { FieldDropdown } from "./field_dropdown";

export interface FieldImageDropdownOptions extends FieldCustomDropdownOptions {
    columns?: string;
    maxRows?: string;
    width?: string;
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

    protected activeDescendantIndex: number | undefined;
    protected buttons: HTMLDivElement[] = [];

    constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
        super(options.data);

        this.columns_ = parseInt(options.columns);
        this.maxRows_ = parseInt(options.maxRows) || 0;
        this.width_ = parseInt(options.width) || 300;

        this.backgroundColour_ = parseColour(options.colour);
        this.borderColour_ = pxt.toolbox.fadeColor(this.backgroundColour_, 0.4, false);
    }

    protected addKeyHandler(contentDiv: HTMLDivElement) {
        Blockly.browserEvents.bind(contentDiv, 'keydown', this, (e: KeyboardEvent) => {
            if (this.activeDescendantIndex === undefined) {
                return;
            }
            const ctrlCmd = pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey;
            switch(e.code) {
                case 'ArrowUp':
                    if (this.activeDescendantIndex - this.columns_ >= 0) {
                        this.activeDescendantIndex -= this.columns_;
                    }
                    break;
                case 'ArrowDown':
                    if (this.activeDescendantIndex + this.columns_ < this.buttons.length) {
                        this.activeDescendantIndex += this.columns_;
                    }
                    break;
                case 'ArrowRight':
                    if (this.activeDescendantIndex < this.buttons.length - 1) {
                        this.activeDescendantIndex++;
                    }
                    break;
                case 'ArrowLeft':
                    if (this.activeDescendantIndex !== 0) {
                        this.activeDescendantIndex--;
                    }
                    break;
                case "Home": {
                    if (ctrlCmd) {
                        this.activeDescendantIndex = 0;
                    } else {
                        while (this.activeDescendantIndex % this.columns_ !== 0) {
                            this.activeDescendantIndex--;
                        }
                    }
                    break;
                }
                case "End": {
                    if (ctrlCmd) {
                        this.activeDescendantIndex = this.buttons.length - 1;
                    } else {
                        while (
                          this.activeDescendantIndex % this.columns_ !== this.columns_ - 1 &&
                          this.activeDescendantIndex < this.buttons.length - 1
                        ) {
                          this.activeDescendantIndex++;
                        }
                    }
                    break;
                }
                case "Enter":
                case "Space": {
                    this.buttonClick_(this.buttons[this.activeDescendantIndex].getAttribute('data-value'));
                }
                default: {
                    return
                }
            }
            this.buttons.forEach(button => button.setAttribute('class', 'blocklyDropDownButton'));
            const activeButton = this.buttons[this.activeDescendantIndex];
            const activeButtonContainer = activeButton.parentElement;
            activeButton.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonFocus');
            const activeButtonRect = activeButtonContainer.getBoundingClientRect();
            // Has to be the parent element as the contents of the contentDiv are all floated.
            const containerRect = contentDiv.parentElement.getBoundingClientRect();
            if (activeButtonRect.bottom > containerRect.bottom) {
                activeButtonContainer.scrollIntoView({block: "end"});
            } else if (activeButtonRect.top < containerRect.top) {
                activeButtonContainer.scrollIntoView({block: "start"});
            }
            contentDiv.setAttribute('aria-activedescendant', ":" + this.activeDescendantIndex);
            e.preventDefault();
            e.stopPropagation();
        });
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
    public showEditor_(e?: MouseEvent) {
        // If there is an existing drop-down we own, this is a request to hide the drop-down.
        if (Blockly.DropDownDiv.hideIfOwner(this)) {
            return;
        }
        // If there is an existing drop-down someone else owns, hide it immediately and clear it.
        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.DropDownDiv.clearContent();
        // Populate the drop-down with the icons for this field.
        let dropdownDiv = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        let contentDiv = document.createElement('div');
        // Accessibility properties
        contentDiv.setAttribute('role', 'grid');
        contentDiv.setAttribute('tabindex', '0');
        contentDiv.setAttribute('class', 'blocklyMenu');
        this.addKeyHandler(contentDiv)
        const options = this.getOptions();
        let maxButtonHeight: number = 0;
        let selectedButtonContainer;
        let row = this.createRow();
        for (let i = 0; i < options.length; i++) {
            let content = (options[i] as any)[0]; // Human-readable text or image.
            const value = (options[i] as any)[1]; // Language-neutral value.
            // Icons with the type property placeholder take up space but don't have any functionality
            // Use for special-case layouts
            if (content.type == 'placeholder') {
                let placeholder = document.createElement('span');
                placeholder.setAttribute('class', 'blocklyDropDownPlaceholder');
                placeholder.style.width = content.width + 'px';
                placeholder.style.height = content.height + 'px';
                contentDiv.appendChild(placeholder);
                continue;
            }
            const buttonContainer = document.createElement('div');
            buttonContainer.setAttribute('class', 'blocklyDropDownButtonContainer')
            let button = document.createElement('div');
            button.setAttribute('id', ':' + i); // For aria-activedescendant
            button.setAttribute('role', 'gridcell');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('class', 'blocklyDropDownButton');
            button.title = content.alt;
            let buttonSize = content.height;
            if (this.columns_) {
                buttonSize = ((this.width_ / this.columns_) - 8);
                button.style.width = buttonSize + 'px';
                button.style.height = buttonSize + 'px';
            } else {
                button.style.width = content.width + 'px';
                button.style.height = content.height + 'px';
            }
            if (buttonSize > maxButtonHeight) {
                maxButtonHeight = buttonSize;
            }
            let backgroundColor = this.backgroundColour_;
            if (value == this.getValue()) {
                // This icon is selected, show it in a different colour
                backgroundColor = (this.sourceBlock_ as Blockly.BlockSvg).getColourTertiary();
                button.setAttribute('aria-selected', 'true');
                this.activeDescendantIndex = i;
                contentDiv.setAttribute('aria-activedescendant', button.id);
                button.setAttribute('class', `blocklyDropDownButton ${e ? "blocklyDropDownButtonHover" : "blocklyDropDownButtonFocus"}`);
                selectedButtonContainer = buttonContainer;
            }
            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = this.borderColour_;
            Blockly.browserEvents.bind(button, 'click', this, () => this.buttonClick_(value));
            Blockly.browserEvents.bind(button, 'mouseover', this, () => {
                this.buttons.forEach(button => button.setAttribute('class', 'blocklyDropDownButton'));
                this.activeDescendantIndex = i;
                button.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                contentDiv.setAttribute('aria-activedescendant', button.id);
            });
            Blockly.browserEvents.bind(button, 'mouseout', this, () => {
                button.setAttribute('class', 'blocklyDropDownButton');
                contentDiv.removeAttribute('aria-activedescendant');
                this.activeDescendantIndex = undefined;
            });
            let buttonImg = document.createElement('img');
            buttonImg.src = content.src;
            //buttonImg.alt = icon.alt;
            // Upon click/touch, we will be able to get the clicked element as e.target
            // Store a data attribute on all possible click targets so we can match it to the icon.
            button.setAttribute('data-value', value);
            buttonImg.setAttribute('data-value', value);
            button.appendChild(buttonImg);
            this.buttons.push(button);
            buttonContainer.appendChild(button)
            row.append(buttonContainer)
            if (row.childElementCount === this.columns_) {
                contentDiv.appendChild(row);
                row = this.createRow();
            }
        }
        if (row.childElementCount) {
            contentDiv.appendChild(row);
        }
        contentDiv.style.width = this.width_ + 'px';
        dropdownDiv.appendChild(contentDiv);
        if (this.maxRows_) {
            // Limit the number of rows shown, but add a partial next row to indicate scrolling
            dropdownDiv.style.maxHeight = (this.maxRows_ + 0.4) * (maxButtonHeight + 8) + 'px';
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

    /**
     * Callback for when a button is clicked inside the drop-down.
     * Should be bound to the FieldIconMenu.
     * @param {Event} e DOM event for the click/touch
     * @private
     */
    protected buttonClick_ = (value: string | null) => {
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
        content.removeAttribute('aria-activedescendant');
        this.activeDescendantIndex = undefined;
        this.buttons = [];
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