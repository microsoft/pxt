/// <reference path="../../localtypings/blockly.d.ts" />

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

        constructor(text: string, options: FieldGridPickerOptions, validator?: Function) {
            super(options.data);

            this.columns_ = parseInt(options.columns) || 4;
            this.maxRows_ = parseInt(options.maxRows) || 0;
            this.width_ = parseInt(options.width) || 400;

            this.backgroundColour_ = pxtblockly.parseColour(options.colour);
            this.itemColour_ = options.itemColour || "rgba(255, 255, 255, 0.6)";
            this.borderColour_ = Blockly.PXTUtils.fadeColour(this.backgroundColour_, 0.4, false);

            let tooltipCfg: FieldGridPickerToolTipConfig = {
                xOffset: parseInt(options.tooltipsXOffset) || 15,
                yOffset: parseInt(options.tooltipsYOffset) || -10
            }

            this.tooltipConfig_ = tooltipCfg;
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
         * Create a dropdown menu under the text.
         * @private
         */
        public showEditor_() {
            Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, null);

            this.disposeTooltips();

            const options = this.getOptions_();

            // Container for the menu rows
            const tableContainer = new goog.ui.Control();

            // Container used to limit the height of the tableContainer, because the tableContainer uses
            // display: table, which ignores height and maxHeight
            const scrollContainer = new goog.ui.Control();

            // Needed to correctly style borders and padding around the scrollContainer, because the padding around the
            // scrollContainer is part of the scrollable area and will not be correctly shown at the top and bottom
            // when scrolling
            const paddingContainer = new goog.ui.Control();

            for (let i = 0; i < options.length / this.columns_; i++) {
                let row = this.createRow(i, options);
                tableContainer.addChild(row, true);
            }

            // Record windowSize and scrollOffset before adding menu.
            const windowSize = goog.dom.getViewportSize();
            const scrollOffset = goog.style.getViewportPageOffset(document);
            const xy = this.getAbsoluteXY_();
            const borderBBox = this.getScaledBBox_();
            const div = Blockly.WidgetDiv.DIV;

            scrollContainer.addChild(tableContainer, true);
            paddingContainer.addChild(scrollContainer, true);
            paddingContainer.render(div);
            (paddingContainer.getElement() as HTMLElement).style.border = `solid 1px ${this.borderColour_}`;

            const paddingContainerDom = paddingContainer.getElement() as HTMLElement;
            const scrollContainerDom = scrollContainer.getElement() as HTMLElement;
            const tableContainerDom = tableContainer.getElement() as HTMLElement;

            // Resize the grid picker if width > screen width
            if (this.width_ > windowSize.width) {
                this.width_ = windowSize.width;
            }

            tableContainerDom.style.width = this.width_ + 'px';
            tableContainerDom.style.backgroundColor = this.backgroundColour_;
            scrollContainerDom.style.backgroundColor = this.backgroundColour_;
            paddingContainerDom.style.backgroundColor = this.backgroundColour_;
            tableContainerDom.className = 'blocklyGridPickerMenu';
            scrollContainerDom.className = 'blocklyGridPickerScroller';
            paddingContainerDom.className = 'blocklyGridPickerPadder';

            // Add the tooltips and style the items
            const menuItemsDom = tableContainerDom.getElementsByClassName('goog-menuitem');
            let largestTextItem = -1;

            for (let i = 0; i < menuItemsDom.length; ++i) {
                const elem = menuItemsDom[i] as HTMLElement;
                elem.style.borderColor = this.backgroundColour_;
                elem.style.backgroundColor = this.itemColour_;
                elem.parentElement.className = 'blocklyGridPickerRow';

                const tooltipText = (options[i] as any)[0].alt;
                if (tooltipText) {
                    const tooltip = new goog.ui.Tooltip(elem, tooltipText);
                    const onShowOld = tooltip.onShow;
                    tooltip.onShow = () => {
                        onShowOld.call(tooltip);
                        const newPos = new goog.positioning.ClientPosition(tooltip.cursorPosition.x + this.tooltipConfig_.xOffset,
                            tooltip.cursorPosition.y + this.tooltipConfig_.yOffset);
                        tooltip.setPosition(newPos);
                    };
                    tooltip.setShowDelayMs(0);
                    tooltip.className = 'goog-tooltip blocklyGridPickerTooltip';
                    elem.addEventListener('mousemove', (e: MouseEvent) => {
                        const newPos = new goog.positioning.ClientPosition(e.clientX + this.tooltipConfig_.xOffset,
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
            }

            // Position the menu.
            // Flip menu vertically if off the bottom.
            if (xy.y + paddingContainerSize.height + borderBBox.height >=
                windowSize.height + scrollOffset.y) {
                xy.y -= paddingContainerSize.height + 2;
            } else {
                xy.y += borderBBox.height;
            }

            if (this.sourceBlock_.RTL) {
                xy.x += borderBBox.width;
                xy.x += Blockly.FieldDropdown.CHECKMARK_OVERHANG;

                // Don't go offscreen left.
                if (xy.x < scrollOffset.x + paddingContainerSize.width) {
                    xy.x = scrollOffset.x + paddingContainerSize.width;
                }
            } else {
                xy.x -= Blockly.FieldDropdown.CHECKMARK_OVERHANG;

                // Don't go offscreen right.
                if (xy.x > windowSize.width + scrollOffset.x - paddingContainerSize.width) {
                    xy.x = windowSize.width + scrollOffset.x - paddingContainerSize.width;
                }
            }

            Blockly.WidgetDiv.position(xy.x, xy.y, windowSize, scrollOffset,
                this.sourceBlock_.RTL);
            goog.style.setHeight(div, "auto");

            (<any>tableContainerDom).focus();
        }

        private createRow(row: number, options: (Object | string[])[]): goog.ui.Menu {
            const columns = this.columns_;

            const thisField = this;
            function callback(e: any) {
                const menu = this;
                const menuItem = e.target;

                if (menuItem) {
                    thisField.onItemSelected(menu, menuItem);
                }

                Blockly.WidgetDiv.hideIfOwner(thisField);
                Blockly.Events.setGroup(false);
                thisField.disposeTooltips();
            }

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
            }

            // Listen for mouse/keyboard events.
            goog.events.listen(menu, goog.ui.Component.EventType.ACTION, callback);

            // Listen for touch events (why doesn't Closure handle this already?).
            function callbackTouchStart(e: any) {
                const control = this.getOwnerControl(/** @type {Node} */(e.target));
                // Highlight the menu item.
                control.handleMouseDown(e);
            }

            function callbackTouchEnd(e: any) {
                const control = this.getOwnerControl(/** @type {Node} */(e.target));
                // Activate the menu item.
                control.performActionInternal(e);
            }

            menu.getHandler().listen(menu.getElement(), goog.events.EventType.TOUCHSTART,
                callbackTouchStart);
            menu.getHandler().listen(menu.getElement(), goog.events.EventType.TOUCHEND,
                callbackTouchEnd);

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
    }
}