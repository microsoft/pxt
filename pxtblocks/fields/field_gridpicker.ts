/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    export interface FieldGridPickerToolTipConfig {
        yOffset?: number;
        xOffset?: number;
    }

    export interface FieldGridPickerOptions extends Blockly.FieldCustomDropdownOptions {
        columns?: string;
        maxRows?: string;
        width?: string;
        itemColour?: string;
        tooltips?: string;
        tooltipsXOffset?: string;
        tooltipsYOffset?: string;
        hasSearchBar?: boolean;
        hideRect?: boolean;
    }

    export class FieldGridPicker extends Blockly.FieldDropdown implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        // Width in pixels
        private width_: number;

        // Columns in grid
        private columns_: number;

        // Number of rows to display (if there are extra rows, the picker will be scrollable)
        private maxRows_: number;

        private backgroundColour_: string;
        private itemColour_: string;
        private borderColour_: string;

        private tooltipConfig_: FieldGridPickerToolTipConfig;

        private tooltips_: goog.ui.Tooltip[] = [];
        private firstItem_: goog.ui.MenuItem;
        private menu_: goog.ui.Menu;

        private hasSearchBar_: boolean;
        private hideRect_: boolean;

        protected dropDownOpen_: boolean;

        constructor(text: string, options: FieldGridPickerOptions, validator?: Function) {
            super(options.data);

            this.columns_ = parseInt(options.columns) || 4;
            this.maxRows_ = parseInt(options.maxRows) || 0;
            this.width_ = parseInt(options.width) || 400;

            this.backgroundColour_ = pxtblockly.parseColour(options.colour);
            this.itemColour_ = options.itemColour || "rgba(255, 255, 255, 0.6)";
            this.borderColour_ = pxt.toolbox.fadeColor(this.backgroundColour_, 0.4, false);

            let tooltipCfg: FieldGridPickerToolTipConfig = {
                xOffset: parseInt(options.tooltipsXOffset) || 15,
                yOffset: parseInt(options.tooltipsYOffset) || -10
            }

            this.tooltipConfig_ = tooltipCfg;
            this.hasSearchBar_ = !!options.hasSearchBar || false;
            this.hideRect_ = !!options.hideRect || false;
        }

        /**
         * When disposing the grid picker, make sure the tooltips are disposed too.
         * @public
         */
        public dispose() {
            super.dispose();
            this.disposeTooltips();
        }

        /**
         * Create blocklyGridPickerRows and add them to table container
         * @param options
         * @param tableContainer
         */
        private populateTableContainer(options: (Object | String[])[], tableContainer: goog.ui.Control) {
            this.disposeTooltips();
            tableContainer.removeChildren(true);
            if (options.length == 0) {
                this.firstItem_ = undefined
            }
            for (let i = 0; i < options.length / this.columns_; i++) {
                let row = this.createRow(i, options);
                tableContainer.addChild(row, true);
            }
            let tableContainerDom = tableContainer.getElement();
            if (tableContainerDom) {
                let menuItemsDom = tableContainerDom.childNodes;
                for (let i = 0; i < menuItemsDom.length; ++i) {
                    const elem = menuItemsDom[i] as HTMLElement;
                    elem.className = "blocklyGridPickerRow";
                }
            }
        }

        /**
         * Add the tooltips and style the items
         * @param options
         * @param tableContainer
         */
        private createTooltips(options: (Object | String[])[], tableContainer: goog.ui.Control) {
            let needToFloatLeft = (options.length < this.columns_);
            let tableContainerDom = tableContainer.getElement() as HTMLElement;
            const menuItemsDom = tableContainerDom.getElementsByClassName('goog-menuitem');
            let largestTextItem = -1;

            for (let i = 0; i < menuItemsDom.length; ++i) {
                const elem = menuItemsDom[i] as HTMLElement;
                elem.style.borderColor = this.backgroundColour_;
                elem.style.backgroundColor = this.itemColour_;
                if (needToFloatLeft) {
                    elem.className += " floatLeft";
                }

                const tooltipText = (options[i] as any)[0].alt;
                if (tooltipText) {
                    const tooltip = new goog.ui.Tooltip(elem, tooltipText);
                    const onShowOld = tooltip.onShow;
                    const isRTL = this.sourceBlock_.RTL;
                    const xOffset = (isRTL ? -this.tooltipConfig_.xOffset : this.tooltipConfig_.xOffset);
                    tooltip.onShow = () => {
                        onShowOld.call(tooltip);
                        const newPos = new goog.positioning.ClientPosition(tooltip.cursorPosition.x + xOffset,
                            tooltip.cursorPosition.y + this.tooltipConfig_.yOffset);
                        tooltip.setPosition(newPos);
                    };
                    tooltip.setShowDelayMs(0);
                    tooltip.className = 'goog-tooltip blocklyGridPickerTooltip';
                    elem.addEventListener('mousemove', (e: MouseEvent) => {
                        const newPos = new goog.positioning.ClientPosition(e.clientX + xOffset,
                            e.clientY + this.tooltipConfig_.yOffset);
                        tooltip.setPosition(newPos);
                    });
                    this.tooltips_.push(tooltip);
                } else {
                    const elemWidth = goog.style.getSize(elem).width;
                    if (elemWidth > largestTextItem) {
                        largestTextItem = elemWidth;
                    }
                }
            }

            // Resize text items so they have a uniform width
            if (largestTextItem > -1) {
                for (let i = 0; i < menuItemsDom.length; ++i) {
                    const elem = menuItemsDom[i] as HTMLElement;
                    goog.style.setWidth(elem, largestTextItem);
                }
            }
        }

        /**
         * Whether or not to show a box around the dropdown menu.
         * @return {boolean} True if we should show a box (rect) around the dropdown menu. Otherwise false.
         * @private
         */
        shouldShowRect_() {
            return !this.hideRect_ ? !this.sourceBlock_.isShadow() : false;
        }

        /**
         * Selects menu item and closes gridpicker
         * @param item = the item to select
         */
        private selectItem(item: goog.ui.MenuItem) {
            if (this.menu_) {
                this.onItemSelected(this.menu_, item)
                this.close()
            }
        }

        /**
         * Set the language-neutral value for this dropdown menu.
         * We have to override this from field.js because the grid picker needs to redraw the selected item's image.
         * @param {string} newValue New value to set.
         */
        public setValue(newValue: string) {
            if (newValue === null || newValue === this.value_) {
                return;  // No change if null.
            }
            if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                Blockly.Events.fire(new Blockly.Events.BlockChange(
                    this.sourceBlock_, 'field', this.name, this.value_, newValue));
            }
            // Clear menu item for old value.
            if (this.selectedItem) {
                this.selectedItem.setChecked(false);
                this.selectedItem = null;
            }
            this.value_ = newValue;
            // Look up and display the human-readable text.
            let options = this.getOptions();
            for (let i = 0; i < options.length; i++) {
                // Options are tuples of human-readable text and language-neutral values.
                if ((options[i] as any)[1] == newValue) {
                    let content = (options[i] as any)[0];
                    if (typeof content == 'object') {
                        this.imageJson_ = content;
                        this.setText(content.alt); // Use setText() because it handles displaying image selection
                    } else {
                        this.imageJson_ = null;
                        this.setText(content); // Use setText() because it handles displaying image selection
                    }
                    return;
                }
            }
            // Value not found.  Add it, maybe it will become valid once set
            // (like variable names).
            this.setText(newValue); // Use setText() because it handles displaying image selection
        };

        /**
         * Closes the gridpicker.
         */
        private close() {
            Blockly.WidgetDiv.hideIfOwner(this);
            Blockly.Events.setGroup(false);
            this.disposeTooltips();
        }

        /**
         * Getter method
         */
        private getFirstItem() {
            return this.firstItem_
        }

        /**
         * Highlight first item in menu, de-select and de-highlight all others
         */
        private highlightFirstItem(tableContainerDom: HTMLElement) {
            let menuItemsDom = tableContainerDom.childNodes;
            if (menuItemsDom.length && menuItemsDom[0].childNodes) {
                for (let row = 0; row < menuItemsDom.length; ++row) {
                    let rowLength = menuItemsDom[row].childNodes.length
                    for (let col = 0; col < rowLength; ++col) {
                        const menuItem = menuItemsDom[row].childNodes[col] as HTMLElement
                        menuItem.classList.remove("goog-menuitem-highlight")
                        menuItem.classList.remove("goog-option-selected")
                    }
                }
                let firstItem = menuItemsDom[0].childNodes[0] as HTMLElement;
                firstItem.className += " goog-menuitem-highlight"
            }
        }

        /**
         * Scroll menu to item that equals current value of gridpicker
         */
        private highlightAndScrollSelected(tableContainer: goog.ui.Control, scrollContainerDom: HTMLElement) {
            let tableContainerDom = tableContainer.getElement() as HTMLElement
            const rowCount = tableContainer.getChildCount();
            let selectedItemDom: any;
            for (let row = 0; row < rowCount; ++row) {
                for (let col = 0; col < this.columns_; ++col) {
                    const val = (tableContainer.getChildAt(row).getChildAt(col) as goog.ui.MenuItem).getValue();
                    if (this.value_ === val) {
                        selectedItemDom = (tableContainerDom.children[row] as HTMLElement).children[col];
                        break;
                    }
                }
                if (selectedItemDom) {
                    goog.style.scrollIntoContainerView(selectedItemDom, scrollContainerDom, true);
                    break;
                }
            }

        }

        /**
         * Create a dropdown menu under the text.
         * @private
         */
        public showEditor_() {
            this.dropDownOpen_ = true;
            Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, null);

            this.disposeTooltips();

            let options = this.getOptions();

            // Container for the menu rows
            const tableContainer = new goog.ui.Control();
            //const tableContainer = this.getTableContainer(options);
            this.populateTableContainer(options, tableContainer);

            // Container used to limit the height of the tableContainer, because the tableContainer uses
            // display: table, which ignores height and maxHeight
            const scrollContainer = new goog.ui.Control();

            // Needed to correctly style borders and padding around the scrollContainer, because the padding around the
            // scrollContainer is part of the scrollable area and will not be correctly shown at the top and bottom
            // when scrolling
            const paddingContainer = new goog.ui.Control();

            // Record windowSize and scrollOffset before adding menu.
            const windowSize = goog.dom.getViewportSize();
            const scrollOffset = goog.style.getViewportPageOffset(document);
            const xy = this.getAbsoluteXY_();
            const borderBBox = this.getScaledBBox_();
            const div = Blockly.WidgetDiv.DIV;

            scrollContainer.addChild(tableContainer, true);
            paddingContainer.addChild(scrollContainer, true);
            paddingContainer.render(div);

            const paddingContainerDom = paddingContainer.getElement() as HTMLElement;
            const scrollContainerDom = scrollContainer.getElement() as HTMLElement;
            const tableContainerDom = tableContainer.getElement() as HTMLElement;

            // Search bar
            if (this.hasSearchBar_) {
                const searchBarDiv = document.createElement("div");
                searchBarDiv.setAttribute("class", "ui fluid icon input");
                const searchIcon = document.createElement("i");
                searchIcon.setAttribute("class", "search icon");
                const searchBar = document.createElement("input");
                searchBar.setAttribute("type", "search");
                searchBar.setAttribute("id", "search-bar");
                searchBar.setAttribute("class", "blocklyGridPickerSearchBar");
                searchBar.setAttribute("placeholder", pxt.Util.lf("Search"));
                searchBar.addEventListener("click", () => {
                    searchBar.focus();
                    searchBar.setSelectionRange(0, searchBar.value.length);
                });
                searchBar.addEventListener("keyup", pxt.Util.debounce(() => {
                    let text = searchBar.value;
                    let re = new RegExp(text, "i");
                    let filteredOptions = options.filter((block) => {
                        const alt = (block as any)[0].alt; // Human-readable text or image.
                        const value = (block as any)[1]; // Language-neutral value.
                        return alt ? re.test(alt) : re.test(value);
                    })
                    this.populateTableContainer.bind(this)(filteredOptions, tableContainer);
                    this.createTooltips(filteredOptions, tableContainer)
                    if (text) {
                        this.highlightFirstItem(tableContainerDom)
                    } else {
                        this.highlightAndScrollSelected(tableContainer, scrollContainerDom)
                    }
                }, 300, false));

                searchBar.addEventListener("keyup", (e) => {
                    if (e.keyCode == 13) {
                        let text = searchBar.value;
                        let firstItem = this.getFirstItem()
                        if (text && firstItem) {
                            this.selectItem(firstItem)
                        }
                    }
                })
                searchBarDiv.appendChild(searchBar);
                searchBarDiv.appendChild(searchIcon);
                paddingContainerDom.insertBefore(searchBarDiv, paddingContainerDom.childNodes[0]);
                searchBar.focus();
            }

            paddingContainerDom.style.border = `solid 1px ${this.borderColour_}`;

            tableContainerDom.style.backgroundColor = this.backgroundColour_;
            scrollContainerDom.style.backgroundColor = this.backgroundColour_;
            paddingContainerDom.style.backgroundColor = this.backgroundColour_;
            tableContainerDom.className = 'blocklyGridPickerMenu';
            scrollContainerDom.className = 'blocklyGridPickerScroller';
            paddingContainerDom.className = 'blocklyGridPickerPadder';

            this.createTooltips(options, tableContainer);

            // Resize the grid picker if width > screen width
            if (this.width_ > windowSize.width) {
                this.width_ = windowSize.width;
            }
            tableContainerDom.style.width = this.width_ + 'px';

            // Record current container sizes after adding menu.
            const paddingContainerSize = goog.style.getSize(paddingContainerDom);
            const scrollContainerSize = goog.style.getSize(scrollContainerDom);

            // Recalculate dimensions for the total content, not only box.
            scrollContainerSize.height = scrollContainerDom.scrollHeight;
            scrollContainerSize.width = scrollContainerDom.scrollWidth;
            paddingContainerSize.height = paddingContainerDom.scrollHeight;
            paddingContainerSize.width = paddingContainerDom.scrollWidth;

            // Limit scroll container's height if a row limit was specified
            if (this.maxRows_ > 0) {
                const firstRowDom = tableContainerDom.children[0];
                const rowSize = goog.style.getSize(firstRowDom);

                // Compute maxHeight using maxRows + 0.3 to partially show next row, to hint at scrolling
                const maxHeight = rowSize.height * (this.maxRows_ + 0.3);

                // If the current height is greater than the computed max height, limit the height of the scroll
                // container and increase its width to accomodate the scrollbar
                if (scrollContainerSize.height > maxHeight) {
                    scrollContainerDom.style.overflowY = "auto";
                    goog.style.setHeight(scrollContainerDom, maxHeight);

                    // Calculate total border, margin and padding width
                    const scrollPaddings = goog.style.getPaddingBox(scrollContainerDom);
                    const scrollPaddingWidth = scrollPaddings.left + scrollPaddings.right;
                    const scrollMargins = goog.style.getMarginBox(scrollContainerDom);
                    const scrollMarginWidth = scrollMargins.left + scrollMargins.right;
                    const scrollBorders = goog.style.getBorderBox(scrollContainerDom);
                    const scrollBorderWidth = scrollBorders.left + scrollBorders.right;
                    const totalExtraWidth = scrollPaddingWidth + scrollMarginWidth + scrollBorderWidth;

                    // Increase scroll container's width by the width of the scrollbar, so that we don't have horizontal scrolling
                    const scrollbarWidth = scrollContainerDom.offsetWidth - scrollContainerDom.clientWidth - totalExtraWidth;
                    goog.style.setWidth(scrollContainerDom, scrollContainerSize.width + scrollbarWidth);

                    // Refresh the padding container's dimensions
                    paddingContainerSize.height = paddingContainerDom.scrollHeight;
                    paddingContainerSize.width = paddingContainerDom.scrollWidth;

                    // Scroll the currently selected item into view
                    this.highlightAndScrollSelected(tableContainer, scrollContainerDom);
                }
            }

            // Position the menu.
            // Flip menu vertically if off the bottom.
            const borderBBoxHeight = borderBBox.bottom - xy.y;
            const borderBBoxWidth = borderBBox.right - xy.x;
            if (xy.y + paddingContainerSize.height + borderBBoxHeight >=
                windowSize.height + scrollOffset.y) {
                xy.y -= paddingContainerSize.height + 2;
            } else {
                xy.y += borderBBoxHeight;
            }

            if (this.sourceBlock_.RTL) {
                xy.x -= paddingContainerSize.width / 2;

                // Don't go offscreen left.
                if (xy.x < scrollOffset.x) {
                    xy.x = scrollOffset.x;
                }
            } else {
                xy.x += borderBBoxWidth / 2 - paddingContainerSize.width / 2;

                // Don't go offscreen right.
                if (xy.x > windowSize.width + scrollOffset.x - paddingContainerSize.width) {
                    xy.x = windowSize.width + scrollOffset.x - paddingContainerSize.width;
                }
            }

            Blockly.WidgetDiv.position(xy.x, xy.y, windowSize, scrollOffset,
                this.sourceBlock_.RTL);

            (<any>tableContainerDom).focus();
        }

        private createRow(row: number, options: (Object | string[])[]): goog.ui.Menu {
            const columns = this.columns_;

            const menu = new goog.ui.Menu();
            menu.setRightToLeft(this.sourceBlock_.RTL);

            for (let i = (columns * row); i < Math.min((columns * row) + columns, options.length); i++) {
                let content = (options[i] as any)[0]; // Human-readable text or image.
                const value = (options[i] as any)[1]; // Language-neutral value.

                if (typeof content == 'object') {
                    // An image, not text.
                    const image = new Image(content['width'], content['height']);
                    image.src = content['src'];
                    image.alt = content['alt'] || '';
                    content = image;
                }

                const menuItem = new goog.ui.MenuItem(content);
                menuItem.setRightToLeft(this.sourceBlock_.RTL);
                menuItem.setValue(value);
                menuItem.setCheckable(true);
                menuItem.setChecked(value == this.value_);
                menu.addChild(menuItem, true);
                if (i == 0) {
                    this.firstItem_ = menuItem;
                }
            }

            // Listen for mouse/keyboard events.
            goog.events.listen(menu, goog.ui.Component.EventType.ACTION, (e: any) => {
                const menuItem = e.target;
                if (menuItem) {
                    this.selectItem.bind(this)(menuItem)
                }
            });

            this.menu_ = menu;
            return menu;
        }

        /**
         * Disposes the tooltip DOM elements.
         * @private
         */
        private disposeTooltips() {
            if (this.tooltips_ && this.tooltips_.length) {
                this.tooltips_.forEach((t) => t.dispose());
                this.tooltips_ = [];
            }
        }

        /**
         * Sets the text in this field.  Trigger a rerender of the source block.
         * @param {?string} text New text.
         */
        setText(text: string) {
            if (text === null || text === this.text_) {
                // No change if null.
                return;
            }
            this.text_ = text;
            this.updateTextNode_();

            if (this.imageJson_ && this.textElement_) {
                // Update class for dropdown text.
                // This class is reset every time updateTextNode_ is called.
                this.textElement_.setAttribute('class',
                    this.textElement_.getAttribute('class') + ' blocklyHidden'
                );
                this.imageElement_.parentNode.appendChild(this.arrow_);
            } else if (this.textElement_) {
                // Update class for dropdown text.
                // This class is reset every time updateTextNode_ is called.
                this.textElement_.setAttribute('class',
                    this.textElement_.getAttribute('class') + ' blocklyDropdownText'
                );
                this.textElement_.parentNode.appendChild(this.arrow_);
            }
            if (this.sourceBlock_ && this.sourceBlock_.rendered) {
                this.sourceBlock_.render();
                this.sourceBlock_.bumpNeighbours_();
            }
        };

        /**
         * Updates the width of the field. This calls getCachedWidth which won't cache
         * the approximated width on IE/Edge when `getComputedTextLength` fails. Once
         * it eventually does succeed, the result will be cached.
         **/
        updateWidth() {
            let width: number;
            if (this.imageJson_) {
                width = this.imageJson_.width + 5;
                this.arrowY_ = this.imageJson_.height / 2;
            } else {
                // Calculate width of field
                width = Blockly.Field.getCachedWidth(this.textElement_);
            }

            // Add padding to left and right of text.
            if (this.EDITABLE) {
                width += Blockly.BlockSvg.EDITABLE_FIELD_PADDING;
            }

            // Adjust width for drop-down arrows.
            this.arrowWidth_ = 0;
            if (this.positionArrow) {
                this.arrowWidth_ = this.positionArrow(width);
                width += this.arrowWidth_;
            }

            // Add padding to any drawn box.
            if (this.box_) {
                width += 2 * Blockly.BlockSvg.BOX_FIELD_PADDING;
            }

            // Set width of the field.
            this.size_.width = width;
        };

        /**
         * Update the text node of this field to display the current text.
         * @private
         */
        updateTextNode_() {
            if (!this.textElement_ && !this.imageElement_) {
                // Not rendered yet.
                return;
            }
            let text = this.text_;
            if (text.length > this.maxDisplayLength) {
                // Truncate displayed string and add an ellipsis ('...').
                text = text.substring(0, this.maxDisplayLength - 2) + '\u2026';
                // Add special class for sizing font when truncated
                this.textElement_.setAttribute('class', 'blocklyText blocklyTextTruncated');
            } else {
                this.textElement_.setAttribute('class', 'blocklyText');
            }

            // Empty the text element.
            goog.dom.removeChildren(/** @type {!Element} */(this.textElement_));
            goog.dom.removeNode(this.imageElement_);
            this.imageElement_ = null;
            if (this.imageJson_) {
                // Image option is selected.
                this.imageElement_ = Blockly.utils.createSvgElement('image',
                    {
                        'y': 5, 'x': 8, 'height': this.imageJson_.height + 'px',
                        'width': this.imageJson_.width + 'px', cursor: 'pointer'
                    });
                this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink',
                    'xlink:href', this.imageJson_.src);
                this.size_.height = Number(this.imageJson_.height) + 10;
                if (this.sourceBlock_.RTL)
                    this.imageElement_.setAttribute('transform',
                        'translate(' + this.arrowWidth_ + ', 0)'
                    );

                this.textElement_.parentNode.appendChild(this.imageElement_);
            } else {
                // Replace whitespace with non-breaking spaces so the text doesn't collapse.
                text = text.replace(/\s/g, Blockly.Field.NBSP);
                if (this.sourceBlock_.RTL && text) {
                    // The SVG is LTR, force text to be RTL.
                    text += '\u200F';
                }
                if (!text) {
                    // Prevent the field from disappearing if empty.
                    text = Blockly.Field.NBSP;
                }
                let textNode = document.createTextNode(text);
                this.textElement_.appendChild(textNode);
            }

            // Cached width is obsolete.  Clear it.
            this.size_.width = 0;
        };
    }
}