namespace pxtblockly {
    export interface FieldImagesOptions extends pxtblockly.FieldImageDropdownOptions {
    }

    export class FieldImages extends pxtblockly.FieldImageDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        constructor(text: string, options: FieldImagesOptions, validator?: Function) {
            super(text, options, validator);
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
            Blockly.DropDownDiv.clearContent();
            // Populate the drop-down with the icons for this field.
            let dropdownDiv = Blockly.DropDownDiv.getContentDiv();
            let contentDiv = document.createElement('div');
            // Accessibility properties
            contentDiv.setAttribute('role', 'menu');
            contentDiv.setAttribute('aria-haspopup', 'true');
            const options = this.getOptions();
            for (let i = 0, option: any; option = options[i]; i++) {
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
                let button = document.createElement('button');
                button.setAttribute('id', ':' + i); // For aria-activedescendant
                button.setAttribute('role', 'menuitem');
                button.setAttribute('class', 'blocklyDropDownButton');
                button.title = content.alt;
                if ((this as any).columns_) {
                    button.style.width = (((this as any).width_ / (this as any).columns_) - 8) + 'px';
                    //button.style.height = ((this.width_ / this.columns_) - 8) + 'px';
                } else {
                    button.style.width = content.width + 'px';
                    button.style.height = content.height + 'px';
                }
                let backgroundColor = this.sourceBlock_.getColour();
                if (value == this.getValue()) {
                    // This icon is selected, show it in a different colour
                    backgroundColor = this.sourceBlock_.getColourTertiary();
                    button.setAttribute('aria-selected', 'true');
                }
                button.style.backgroundColor = backgroundColor;
                button.style.borderColor = this.sourceBlock_.getColourTertiary();
                Blockly.bindEvent_(button, 'click', this, (this as any).buttonClick_);
                Blockly.bindEvent_(button, 'mouseup', this, (this as any).buttonClick_);
                // These are applied manually instead of using the :hover pseudoclass
                // because Android has a bad long press "helper" menu and green highlight
                // that we must prevent with ontouchstart preventDefault
                Blockly.bindEvent_(button, 'mousedown', button, function (e) {
                    this.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                    e.preventDefault();
                });
                Blockly.bindEvent_(button, 'mouseover', button, function () {
                    this.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                    contentDiv.setAttribute('aria-activedescendant', this.id);
                });
                Blockly.bindEvent_(button, 'mouseout', button, function () {
                    this.setAttribute('class', 'blocklyDropDownButton');
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
                contentDiv.appendChild(button);
            }
            contentDiv.style.width = (this as any).width_ + 'px';
            dropdownDiv.appendChild(contentDiv);

            Blockly.DropDownDiv.setColour(this.sourceBlock_.getColour(), this.sourceBlock_.getColourTertiary());

            // Calculate positioning based on the field position.
            let scale = this.sourceBlock_.workspace.scale;
            let bBox = { width: this.size_.width, height: this.size_.height };
            bBox.width *= scale;
            bBox.height *= scale;
            let position = this.fieldGroup_.getBoundingClientRect();
            let primaryX = position.left + bBox.width / 2;
            let primaryY = position.top + bBox.height;
            let secondaryX = primaryX;
            let secondaryY = position.top;
            // Set bounds to workspace; show the drop-down.
            (Blockly.DropDownDiv as any).setBoundsElement(this.sourceBlock_.workspace.getParentSvg().parentNode);
            (Blockly.DropDownDiv as any).show(this, primaryX, primaryY, secondaryX, secondaryY,
                (this as any).onHide_.bind(this));
        }
    }
}