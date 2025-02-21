/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldImageDropdown, FieldImageDropdownOptions } from "./field_imagedropdown";
import { FieldCustom } from "./field_utils";

export interface FieldImagesOptions extends FieldImageDropdownOptions {
    sort?: boolean;
    addLabel?: string;
}

export class FieldImages extends FieldImageDropdown implements FieldCustom {
    public isFieldCustom_ = true;

    private shouldSort_: boolean;

    protected addLabel_: boolean;

    constructor(text: string, options: FieldImagesOptions, validator?: Function) {
        super(text, options, validator);

        this.shouldSort_ = options.sort;
        this.addLabel_ = !!options.addLabel;
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
        let sourceBlock = this.sourceBlock_ as Blockly.BlockSvg;
        // If there is an existing drop-down someone else owns, hide it immediately and clear it.
        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.DropDownDiv.clearContent();
        // Populate the drop-down with the icons for this field.
        let dropdownDiv = Blockly.DropDownDiv.getContentDiv();
        let contentDiv = document.createElement('div');
        // Accessibility properties
        contentDiv.setAttribute('role', 'grid');
        contentDiv.setAttribute('tabindex', '0');
        contentDiv.setAttribute('class', 'blocklyMenu blocklyImageMenu');
        this.addKeyHandler(contentDiv)
        const options = this.getOptions();
        if (this.shouldSort_) options.sort();
        let row = this.createRow();
        for (let i = 0; i < options.length; i++) {
            const content = (options[i] as any)[0]; // Human-readable text or image.
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
            if ((this as any).columns_) {
                button.style.width = (((this as any).width_ / (this as any).columns_) - 8) + 'px';
                //button.style.height = ((this.width_ / this.columns_) - 8) + 'px';
            } else {
                button.style.width = content.width + 'px';
                button.style.height = content.height + 'px';
            }
            let backgroundColor = sourceBlock.getColour();
            if (value == this.getValue()) {
                // This icon is selected, show it in a different colour
                backgroundColor = sourceBlock.getColourTertiary();
                button.setAttribute('aria-selected', 'true');
                this.activeDescendantIndex = i;
                contentDiv.setAttribute('aria-activedescendant', button.id);
                button.setAttribute('class', `blocklyDropDownButton ${e ? "blocklyDropDownButtonHover" : "blocklyDropDownButtonFocus"}`);
            }
            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = sourceBlock.getColourTertiary();
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
            if (this.addLabel_) {
                const buttonText = this.createTextNode_(content.alt);
                buttonText.setAttribute('data-value', value);
                button.appendChild(buttonText);
            }
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
        contentDiv.style.width = (this as any).width_ + 'px';
        dropdownDiv.appendChild(contentDiv);

        Blockly.DropDownDiv.setColour(sourceBlock.getColour(), sourceBlock.getColourTertiary());

        // Position based on the field position.
        Blockly.DropDownDiv.showPositionedByField(this, this.onHideCallback.bind(this));

        contentDiv.focus();

        // Update colour to look selected.
        this.savedPrimary_ = sourceBlock?.getColour();
        if (sourceBlock?.isShadow()) {
            sourceBlock.setColour(sourceBlock.style.colourTertiary);
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', sourceBlock.style.colourTertiary);
        }
    }

    // Update color (deselect) on dropdown hide
    protected onHideCallback() {
        const content = Blockly.DropDownDiv.getContentDiv() as HTMLElement;
        content.removeAttribute('role');
        content.removeAttribute('aria-activedescendant');
        this.activeDescendantIndex = undefined;
        this.buttons = [];
        let source = this.sourceBlock_ as Blockly.BlockSvg;
        if (source?.isShadow()) {
            source.setColour(this.savedPrimary_);
        } else if (this.borderRect_) {
            this.borderRect_.setAttribute('fill', this.savedPrimary_);
        }
    }

    protected createTextNode_(text: string) {
        const textSpan = document.createElement('span');
        textSpan.setAttribute('class', 'blocklyDropdownTextLabel');
        textSpan.textContent = text;
        return textSpan;
    }
}

Blockly.Css.register(`
.blocklyImageMenu .blocklyDropDownButton > img {
    top: unset;
    transform: unset;
    margin-top: 4px;
}
.blocklyImageMenu .blocklyDropdownTextLabel {
    line-height: 1.15;
    margin-top: 2px;
}
`)