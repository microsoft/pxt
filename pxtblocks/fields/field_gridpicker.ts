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

        protected backgroundColour_: string;
        protected borderColour_: string;

        private tooltipConfig_: FieldGridPickerToolTipConfig;

        private tooltip_: HTMLElement;
        private firstItem_: HTMLElement;

        private hasSearchBar_: boolean;
        private hideRect_: boolean;

        private observer: IntersectionObserver;

        private selectedItemDom: HTMLElement;

        private closeModal_: boolean;

        // Selected bar
        private selectedBar_: HTMLElement;
        private selectedImg_: HTMLImageElement;
        private selectedBarText_: HTMLElement;
        private selectedBarValue_: string;

        private static DEFAULT_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

        constructor(text: string, options: FieldGridPickerOptions, validator?: Function) {
            super(options.data);

            this.columns_ = parseInt(options.columns) || 4;
            this.maxRows_ = parseInt(options.maxRows) || 0;
            this.width_ = parseInt(options.width) || 200;

            this.backgroundColour_ = pxtblockly.parseColour(options.colour);
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
            this.disposeTooltip();
            this.disposeIntersectionObserver();
        }

        private createTooltip_() {
            if (this.tooltip_) return;

            // Create tooltip
            this.tooltip_ = document.createElement('div');
            this.tooltip_.className = 'goog-tooltip blocklyGridPickerTooltip';
            this.tooltip_.style.position = 'absolute';
            this.tooltip_.style.display = 'none';
            this.tooltip_.style.visibility = 'hidden';
            document.body.appendChild(this.tooltip_);
        }

        /**
         * Create blocklyGridPickerRows and add them to table container
         * @param options
         * @param tableContainer
         */
        private populateTableContainer(options: (Object | String[])[], tableContainer: HTMLElement, scrollContainer: HTMLElement) {

            pxsim.U.removeChildren(tableContainer);
            if (options.length == 0) {
                this.firstItem_ = undefined
            }

            for (let i = 0; i < options.length / this.columns_; i++) {
                let row = this.populateRow(i, options, tableContainer);
                tableContainer.appendChild(row);
            }
        }

        /**
         * Populate a single row and add it to table container
         * @param row
         * @param options
         * @param tableContainer
         */
        private populateRow(row: number, options: (Object | string[])[], tableContainer: HTMLElement): HTMLElement {
            const columns = this.columns_;

            const rowContent = document.createElement('div');
            rowContent.className = 'blocklyGridPickerRow';

            for (let i = (columns * row); i < Math.min((columns * row) + columns, options.length); i++) {
                let content = (options[i] as any)[0]; // Human-readable text or image.
                const value = (options[i] as any)[1]; // Language-neutral value.

                const menuItem = document.createElement('div');
                menuItem.className = 'goog-menuitem goog-option';
                menuItem.setAttribute('id', ':' + i); // For aria-activedescendant
                menuItem.setAttribute('role', 'menuitem');
                menuItem.style.userSelect = 'none';
                menuItem.title = content['alt'] || content;
                menuItem.setAttribute('data-value', value);

                const menuItemContent = document.createElement('div');
                menuItemContent.setAttribute('class', 'goog-menuitem-content');
                menuItemContent.title = content['alt'] || content;
                menuItemContent.setAttribute('data-value', value);

                const hasImages = typeof content == 'object';

                // Set colour
                let backgroundColour = this.backgroundColour_;
                if (value == this.getValue()) {
                    // This option is selected
                    menuItem.setAttribute('aria-selected', 'true');
                    Blockly.utils.addClass(menuItem, 'goog-option-selected');
                    backgroundColour = this.sourceBlock_.getColourTertiary();

                    // Save so we can scroll to it later
                    this.selectedItemDom = menuItem;

                    if (hasImages && !this.shouldShowTooltips()) {
                        this.updateSelectedBar_(content, value);
                    }
                }

                menuItem.style.backgroundColor = backgroundColour;
                menuItem.style.borderColor = this.borderColour_;


                if (hasImages) {
                    // An image, not text.
                    const buttonImg = new Image(content['width'], content['height']);
                    buttonImg.setAttribute('draggable', 'false');
                    if (!('IntersectionObserver' in window)) {
                        // No intersection observer support, set the image url immediately
                        buttonImg.src = content['src'];
                    } else {
                        buttonImg.src = FieldGridPicker.DEFAULT_IMG;
                        buttonImg.setAttribute('data-src', content['src']);
                        this.observer.observe(buttonImg);
                    }
                    buttonImg.alt = content['alt'] || '';
                    buttonImg.setAttribute('data-value', value);
                    menuItemContent.appendChild(buttonImg);
                } else {
                    // text
                    menuItemContent.textContent = content;
                }

                if (this.shouldShowTooltips()) {
                    Blockly.bindEvent_(menuItem, 'click', this, this.buttonClickAndClose_);

                    // Setup hover tooltips
                    const xOffset = (this.sourceBlock_.RTL ? -this.tooltipConfig_.xOffset : this.tooltipConfig_.xOffset);
                    const yOffset = this.tooltipConfig_.yOffset;

                    Blockly.bindEvent_(menuItem, 'mousemove', this, (e: MouseEvent) => {
                        if (hasImages) {
                            this.tooltip_.style.top = `${e.clientY + yOffset}px`;
                            this.tooltip_.style.left = `${e.clientX + xOffset}px`;
                            // Set tooltip text
                            const touchTarget = document.elementFromPoint(e.clientX, e.clientY);
                            const title = (touchTarget as any).title || (touchTarget as any).alt;
                            this.tooltip_.textContent = title;
                            // Show the tooltip
                            this.tooltip_.style.visibility = title ? 'visible' : 'hidden';
                            this.tooltip_.style.display = title ? '' : 'none';
                        }

                        Blockly.utils.addClass(menuItem, 'goog-menuitem-highlight');
                        tableContainer.setAttribute('aria-activedescendant', menuItem.id);
                    });

                    Blockly.bindEvent_(menuItem, 'mouseout', this, (e: MouseEvent) => {
                        if (hasImages) {
                            // Hide the tooltip
                            this.tooltip_.style.visibility = 'hidden';
                            this.tooltip_.style.display = 'none';
                        }

                        Blockly.utils.removeClass(menuItem, 'goog-menuitem-highlight');
                        tableContainer.removeAttribute('aria-activedescendant');
                    });
                } else {
                    if (hasImages) {
                        // Show the selected bar
                        this.selectedBar_.style.display = '';

                        // Show the selected item (in the selected bar)
                        Blockly.bindEvent_(menuItem, 'click', this, (e: MouseEvent) => {
                            if (this.closeModal_) {
                                this.buttonClick_(e);
                            } else {
                                // Clear all current hovers.
                                const currentHovers = tableContainer.getElementsByClassName('goog-menuitem-highlight');
                                for (let i = 0; i < currentHovers.length; i++) {
                                    Blockly.utils.removeClass(currentHovers[i], 'goog-menuitem-highlight');
                                }
                                // Set hover on current item
                                Blockly.utils.addClass(menuItem, 'goog-menuitem-highlight');

                                this.updateSelectedBar_(content, value);
                            }
                        });
                    } else {
                        Blockly.bindEvent_(menuItem, 'click', this, this.buttonClickAndClose_);
                        Blockly.bindEvent_(menuItem, 'mouseup', this, this.buttonClickAndClose_);
                    }
                }

                menuItem.appendChild(menuItemContent);
                rowContent.appendChild(menuItem);

                if (i == 0) {
                    this.firstItem_ = menuItem;
                }
            }

            return rowContent;
        }

        /**
         * Callback for when a button is clicked inside the drop-down.
         * Should be bound to the FieldIconMenu.
         * @param {Event} e DOM event for the click/touch
         * @private
         */
        protected buttonClick_ = function (e: any) {
            let value = e.target.getAttribute('data-value');
            if (value !== null) {
                this.setValue(value);

                // Close the picker
                if (this.closeModal_) {
                    this.close();
                    this.closeModal_ = false;
                }
            }
        };

        protected buttonClickAndClose_ = function (e: any) {
            this.closeModal_ = true;
            this.buttonClick_(e);
        };

        /**
         * Whether or not to show a box around the dropdown menu.
         * @return {boolean} True if we should show a box (rect) around the dropdown menu. Otherwise false.
         * @private
         */
        shouldShowRect_() {
            return !this.hideRect_ ? !this.sourceBlock_.isShadow() : false;
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
            this.disposeTooltip();

            Blockly.WidgetDiv.hideIfOwner(this);
            Blockly.Events.setGroup(false);
        }

        /**
         * Getter method
         */
        private getFirstItem() {
            return this.firstItem_;
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
        private highlightAndScrollSelected(tableContainerDom: HTMLElement, scrollContainerDom: HTMLElement) {
            if (!this.selectedItemDom) return;
            goog.style.scrollIntoContainerView(this.selectedItemDom, scrollContainerDom, true);
        }

        /**
         * Create a dropdown menu under the text.
         * @private
         */
        public showEditor_() {
            Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, () => {
                this.onClose_();
            });

            this.setupIntersectionObserver_();

            this.createTooltip_();

            const tableContainer = document.createElement("div");
            this.positionMenu_(tableContainer);
        }

        private positionMenu_(tableContainer: HTMLElement) {
            // Record viewport dimensions before adding the dropdown.
            const viewportBBox = Blockly.utils.getViewportBBox();
            const anchorBBox = this.getAnchorDimensions_();

            const { paddingContainer, scrollContainer } = this.createWidget_(tableContainer);

            const containerSize = {
                width: paddingContainer.offsetWidth,
                height: paddingContainer.offsetHeight
            }; //goog.style.getSize(paddingContainer);

            // Set width
            const windowSize = goog.dom.getViewportSize();
            if (this.width_ > windowSize.width) {
                this.width_ = windowSize.width;
            }
            tableContainer.style.width = this.width_ + 'px';

            let addedHeight = 0;
            if (this.hasSearchBar_) addedHeight += 50; // Account for search bar
            if (this.selectedBar_) addedHeight += 50; // Account for the selected bar

            // Set height
            if (this.maxRows_) {
                // Calculate height
                const firstRowDom = tableContainer.children[0] as HTMLElement;
                const rowHeight = firstRowDom.offsetHeight;
                // Compute maxHeight using maxRows + 0.3 to partially show next row, to hint at scrolling
                let maxHeight = rowHeight * (this.maxRows_ + 0.3);
                if (windowSize.height < (maxHeight + addedHeight)) {
                    maxHeight = windowSize.height - addedHeight;
                }
                if (containerSize.height > maxHeight) {
                    scrollContainer.style.overflowY = "auto";
                    goog.style.setHeight(scrollContainer, maxHeight);
                    containerSize.height = maxHeight;
                }
            }

            containerSize.height += addedHeight;

            if (this.sourceBlock_.RTL) {
                (Blockly.utils as any).uiMenu.adjustBBoxesForRTL(viewportBBox, anchorBBox, containerSize);
            }

            // Position the menu.
            Blockly.WidgetDiv.positionWithAnchor(viewportBBox, anchorBBox, containerSize,
                this.sourceBlock_.RTL);

//            (<any>scrollContainer).focus();

            this.highlightAndScrollSelected(tableContainer, scrollContainer)
        };

        private shouldShowTooltips() {
            return !pxt.BrowserUtils.isMobile();
        }

        private getAnchorDimensions_() {
            const boundingBox = this.getScaledBBox_();
            if (this.sourceBlock_.RTL) {
                boundingBox.right += Blockly.FieldDropdown.CHECKMARK_OVERHANG;
            } else {
                boundingBox.left -= Blockly.FieldDropdown.CHECKMARK_OVERHANG;
            }
            return boundingBox;
        };

        private createWidget_(tableContainer: HTMLElement) {
            const div = Blockly.WidgetDiv.DIV;

            const options = this.getOptions();

            // Container for the menu rows
            tableContainer.setAttribute("role", "menu");
            tableContainer.setAttribute("aria-haspopup", "true");

            // Container used to limit the height of the tableContainer, because the tableContainer uses
            // display: table, which ignores height and maxHeight
            const scrollContainer = document.createElement("div");

            // Needed to correctly style borders and padding around the scrollContainer, because the padding around the
            // scrollContainer is part of the scrollable area and will not be correctly shown at the top and bottom
            // when scrolling
            const paddingContainer = document.createElement("div");
            paddingContainer.style.border = `solid 1px ${this.borderColour_}`;

            tableContainer.style.backgroundColor = this.backgroundColour_;
            scrollContainer.style.backgroundColor = this.backgroundColour_;
            paddingContainer.style.backgroundColor = this.backgroundColour_;

            tableContainer.className = 'blocklyGridPickerMenu';
            scrollContainer.className = 'blocklyGridPickerScroller';
            paddingContainer.className = 'blocklyGridPickerPadder';

            paddingContainer.appendChild(scrollContainer);
            scrollContainer.appendChild(tableContainer);
            div.appendChild(paddingContainer);

            // Search bar
            if (this.hasSearchBar_) {
                const searchBar = this.createSearchBar_(tableContainer, scrollContainer, options);
                paddingContainer.insertBefore(searchBar, paddingContainer.childNodes[0]);
            }

            // Selected bar
            if (!this.shouldShowTooltips()) {
                this.selectedBar_ = this.createSelectedBar_();
                paddingContainer.appendChild(this.selectedBar_);
            }

            // Render elements
            this.populateTableContainer(options, tableContainer, scrollContainer);


            return { paddingContainer, scrollContainer };
        }

        private createSearchBar_(tableContainer: HTMLElement, scrollContainer: HTMLElement, options: (Object | string[])[]) {
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

            // Search on key change
            searchBar.addEventListener("keyup", pxt.Util.debounce(() => {
                let text = searchBar.value;
                let re = new RegExp(text, "i");
                let filteredOptions = options.filter((block) => {
                    const alt = (block as any)[0].alt; // Human-readable text or image.
                    const value = (block as any)[1]; // Language-neutral value.
                    return alt ? re.test(alt) : re.test(value);
                })
                this.populateTableContainer.bind(this)(filteredOptions, tableContainer, scrollContainer);
                if (text) {
                    this.highlightFirstItem(tableContainer)
                } else {
                    this.highlightAndScrollSelected(tableContainer, scrollContainer)
                }
                // Hide the tooltip
                this.tooltip_.style.visibility = 'hidden';
                this.tooltip_.style.display = 'none';
            }, 300, false));

            // Select the first item if the enter key is pressed
            searchBar.addEventListener("keyup", (e: KeyboardEvent) => {
                const code = e.which;
                if (code == 13) { /* Enter key */
                    // Select the first item in the list
                    const firstRow = tableContainer.childNodes[0] as HTMLElement;
                    if (firstRow) {
                        const firstItem = firstRow.childNodes[0] as HTMLElement;
                        if (firstItem) {
                            this.closeModal_ = true;
                            firstItem.click();
                        }
                    }
                }
            });

            searchBarDiv.appendChild(searchBar);
            searchBarDiv.appendChild(searchIcon);

            return searchBarDiv;
        }

        private createSelectedBar_() {
            const selectedBar = document.createElement("div");
            selectedBar.setAttribute("class", "blocklyGridPickerSelectedBar");
            selectedBar.style.display = 'none';

            const selectedWrapper = document.createElement("div");
            const selectedImgWrapper = document.createElement("div");
            selectedImgWrapper.className = 'blocklyGridPickerSelectedImage';
            selectedWrapper.appendChild(selectedImgWrapper);

            this.selectedImg_ = document.createElement("img");
            this.selectedImg_.setAttribute('width', '30px');
            this.selectedImg_.setAttribute('height', '30px');
            this.selectedImg_.setAttribute('draggable', 'false');
            this.selectedImg_.style.display = 'none';
            this.selectedImg_.src = FieldGridPicker.DEFAULT_IMG;
            selectedImgWrapper.appendChild(this.selectedImg_);

            this.selectedBarText_ = document.createElement("span");
            this.selectedBarText_.className = 'blocklyGridPickerTooltip';
            selectedWrapper.appendChild(this.selectedBarText_);

            const buttonsWrapper = document.createElement("div");
            const buttonsDiv = document.createElement("div");
            buttonsDiv.className = 'ui buttons mini';
            buttonsWrapper.appendChild(buttonsDiv);

            const selectButton = document.createElement("button");
            selectButton.className = "ui button icon green";
            const selectButtonIcon = document.createElement("i");
            selectButtonIcon.className = 'icon check';
            selectButton.appendChild(selectButtonIcon);

            Blockly.bindEvent_(selectButton, 'click', this, () => {
                this.setValue(this.selectedBarValue_);
                this.close();
            });

            const cancelButton = document.createElement("button");
            cancelButton.className = "ui button icon red";
            const cancelButtonIcon = document.createElement("i");
            cancelButtonIcon.className = 'icon cancel';
            cancelButton.appendChild(cancelButtonIcon);

            Blockly.bindEvent_(cancelButton, 'click', this, () => {
                this.close();
            });

            buttonsDiv.appendChild(selectButton);
            buttonsDiv.appendChild(cancelButton);

            selectedBar.appendChild(selectedWrapper);
            selectedBar.appendChild(buttonsWrapper);
            return selectedBar;
        }

        private updateSelectedBar_(content: any, value: string) {
            if (content['src']) {
                this.selectedImg_.src = content['src'];
                this.selectedImg_.style.display = '';
            }
            this.selectedImg_.alt = content['alt'] || content;
            this.selectedBarText_.textContent = content['alt'] || content;
            this.selectedBarValue_ = value;
        }

        private setupIntersectionObserver_() {
            if (!('IntersectionObserver' in window)) return;

            this.disposeIntersectionObserver();

            // setup intersection observer for the image
            const preloadImage = (el: HTMLImageElement) => {
                const lazyImageUrl = el.getAttribute('data-src');
                if (lazyImageUrl) {
                    el.src = lazyImageUrl;
                    el.removeAttribute('data-src');
                }
            }
            const config = {
                // If the image gets within 50px in the Y axis, start the download.
                rootMargin: '20px 0px',
                threshold: 0.01
            };
            const onIntersection: IntersectionObserverCallback = (entries) => {
                entries.forEach(entry => {
                    // Are we in viewport?
                    if (entry.intersectionRatio > 0) {
                        // Stop watching and load the image
                        this.observer.unobserve(entry.target);
                        preloadImage(entry.target as HTMLImageElement);
                    }
                })
            }
            this.observer = new IntersectionObserver(onIntersection, config);
        }

        private disposeIntersectionObserver() {
            if (this.observer) {
                this.observer = null;
            }
        }

        /**
         * Disposes the tooltip DOM.
         * @private
         */
        private disposeTooltip() {
            if (this.tooltip_) {
                pxsim.U.remove(this.tooltip_);
                this.tooltip_ = null;
            }
        }

        private onClose_() {
            this.disposeTooltip();
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
            const sourceBlock = this.sourceBlock_ as Blockly.BlockSvg;
            if (sourceBlock && sourceBlock.rendered) {
                sourceBlock.render();
                sourceBlock.bumpNeighbours_();
            }
        };

        /**
         * Updates the width of the field. This calls getCachedWidth which won't cache
         * the approximated width on IE/Microsoft Edge when `getComputedTextLength` fails. Once
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
