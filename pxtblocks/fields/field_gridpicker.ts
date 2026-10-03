/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomDropdownOptions, parseColour } from "./field_utils";
import { FieldBase } from "./field_base";
import { FieldDropdownGrid } from "./field_dropdowngrid";

export interface FieldGridPickerToolTipConfig {
    yOffset?: number;
    xOffset?: number;
}

export interface FieldGridPickerOptions extends FieldCustomDropdownOptions {
    columns?: string;
    maxRows?: string;
    width?: string;
    tooltips?: string;
    tooltipsXOffset?: string;
    tooltipsYOffset?: string;
    hasSearchBar?: boolean;
    hideRect?: boolean;
    filter?: string;
    catalog?: string;
    enumNames?: string;
    fixedInstances?: boolean;
    optionTags?: pxt.Map<string[]>;
}

export function getGridPickerTags(option: Blockly.MenuOption, optionTags?: pxt.Map<string[]>): string[] {
    const content = typeof option[0] === "object" ? option[0] as { tags?: string[] } : undefined;
    return Array.from(new Set([...(content?.tags || []), ...(optionTags?.[option[1]] || [])]
        .filter(tag => !!tag).map(tag => tag.toLowerCase())));
}

export function filterGridPickerOptions(options: Blockly.MenuOption[], filter: string | string[], optionTags?: pxt.Map<string[]>): Blockly.MenuOption[] {
    const tags = typeof filter === "string" ? filter.split(/\s+/) : filter;
    if (!tags?.some(tag => !!tag)) return options;

    const entries = options.map(option => {
        const content = typeof option[0] === "object"
            ? option[0] as { src?: string; alt?: string; tags?: string[] }
            : undefined;
        return {
            qName: option[1],
            src: content?.src || "",
            alt: content?.alt || String(option[0]),
            tags: getGridPickerTags(option, optionTags)
        };
    });
    const allowed = new Set(pxt.sprite.filterItems(entries, tags).map(entry => entry.qName));
    return options.filter(option => allowed.has(option[1]));
}

export interface GridPickerGroup {
    id: string;
    name: string;
    icon?: string;
    options: Blockly.MenuOption[];
}

export function getGridPickerGroups(
    options: Blockly.MenuOption[],
    catalog: pxt.GridPickerCatalog,
    tab: pxt.GridPickerCategory,
    search: string,
    filter?: string,
    optionTags?: pxt.Map<string[]>
): GridPickerGroup[] {
    let visible = filterGridPickerOptions(options, tab.tags || [], optionTags);
    if (filter) visible = filterGridPickerOptions(visible, filter, optionTags);
    const words = (search || "").trim().toLowerCase().split(/\s+/).filter(word => !!word);
    visible = visible.filter(option => {
        const content = option[0];
        const label = typeof content === "string" ? content : (content as { alt?: string }).alt || "";
        const text = [label, option[1], ...getGridPickerTags(option, optionTags)].join(" ").toLowerCase().replace(/[-_]/g, " ");
        return words.every(word => text.indexOf(word) !== -1);
    });
    const categories = tab.materials ? catalog.materials : catalog.families;
    if (tab.flat || !categories?.length) return [{ id: "all", name: "", options: visible }];

    const claimed = new Set<string>();
    const groups: GridPickerGroup[] = [];
    const variantOrder = tab.materials ? catalog.families : catalog.materials;
    const rank = (option: Blockly.MenuOption): number => {
        const index = variantOrder?.findIndex(category => filterGridPickerOptions([option], category.tags || [], optionTags).length > 0);
        return index === undefined || index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    for (const category of categories) {
        const members = filterGridPickerOptions(visible, category.tags || [], optionTags)
            .filter(option => tab.materials || !claimed.has(option[1]));
        if (!members.length) continue;
        if (variantOrder?.length) members.sort((first, second) => rank(first) - rank(second));
        members.forEach(option => claimed.add(option[1]));
        groups.push({ id: category.id, name: category.name, icon: category.icon, options: members });
    }
    const remaining = visible.filter(option => !claimed.has(option[1]));
    if (remaining.length) groups.push({ id: "other", name: tab.materials ? pxt.Util.lf("Other materials") : "", options: remaining });
    return groups;
}

export function getGridPickerSizeOptions(options: Blockly.MenuOption[], catalog: pxt.GridPickerCatalog, optionTags?: pxt.Map<string[]>): Blockly.MenuOption[] {
    let largest = options;
    for (const tab of catalog.tabs) {
        const expanded: Blockly.MenuOption[] = [];
        for (const group of getGridPickerGroups(options, catalog, tab, "", undefined, optionTags)) {
            if ((group.id !== "other" || tab.materials) && (group.options.length > 1 || tab.materials) && !tab.flat) {
                expanded.push(group.options[0]);
            }
            expanded.push(...group.options);
        }
        if (expanded.length > largest.length) largest = expanded;
    }
    return largest;
}

export class FieldGridPicker extends FieldDropdownGrid implements FieldCustom {
    private tooltipConfig_: FieldGridPickerToolTipConfig;

    private gridTooltip_: HTMLElement;

    private hasSearchBar_: boolean;

    private filter_: string;
    private optionTags_: pxt.Map<string[]>;
    private catalog_: pxt.GridPickerCatalog;
    private blocksInfo_: pxtc.BlocksInfo;
    private catalogTab_: string;
    private catalogSearch_ = "";
    private catalogFilter_ = "";
    private catalogExpanded_ = new Set<string>();
    private catalogFamilies_: pxt.Map<GridPickerGroup> = {};
    private catalogTable_: HTMLElement;
    private catalogContainer_: HTMLElement;
    private catalogStatus_: HTMLElement;
    private catalogTabs_: HTMLButtonElement[] = [];
    private catalogColumns_: number;
    private catalogResizeObserver_: ResizeObserver;
    private catalogContentHeight_: number;
    private catalogAnchor_: Blockly.utils.Rect;

    private observer: IntersectionObserver;

    private selectedItemDom: HTMLElement;

    private closeModal_: boolean;

    // Selected bar
    private selectedBar_: HTMLElement;
    private selectedImg_: HTMLImageElement;
    private selectedBarText_: HTMLElement;
    private selectedBarValue_: string;

    protected scrollContainer: HTMLDivElement;

    private static DEFAULT_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

    private firstFocusableElement: HTMLElement | SVGElement;
    private lastFocusableElement: HTMLElement | SVGElement;
    private tabKeyBind: Blockly.browserEvents.Data | null = null;
    private hasImageOptions: boolean;

    constructor(text: string, options: FieldGridPickerOptions, validator?: Function) {
        super(options.data);

        this.columns_ = parseInt(options.columns) || 4;
        this.maxRows_ = parseInt(options.maxRows) || 0;
        this.width_ = parseInt(options.width) || undefined;

        this.backgroundColour_ = parseColour(options.colour);
        this.borderColour_ = pxt.toolbox.fadeColor(this.backgroundColour_, 0.4, false);

        let tooltipCfg: FieldGridPickerToolTipConfig = {
            xOffset: parseInt(options.tooltipsXOffset) || 15,
            yOffset: parseInt(options.tooltipsYOffset) || -10
        }

        this.tooltipConfig_ = tooltipCfg;
        this.hasSearchBar_ = !!options.hasSearchBar || false;
        this.filter_ = options.filter;
        this.optionTags_ = options.optionTags;
        this.catalog_ = pxt.appTarget?.runtime?.gridPickerCatalogs?.[options.catalog];
        this.blocksInfo_ = options.blocksInfo;
        this.catalogColumns_ = this.columns_;
        if (this.catalog_?.tabs.length) {
            const allowed = filterGridPickerOptions(options.data, this.filter_, this.optionTags_);
            this.catalog_ = { ...this.catalog_, tabs: this.catalog_.tabs.filter(tab =>
                tab.flat || filterGridPickerOptions(allowed, tab.tags || [], this.optionTags_).length > 0
            ) };
            this.hasSearchBar_ = true;
        }
        else this.catalog_ = undefined;

        const dropdownOptions = options.data as [Object | string, string][];
        this.hasImageOptions = dropdownOptions.some(option => typeof option[0] === 'object');
    }

    protected setFocusedItem_(_gridItemContainer: HTMLElement) {
        this.gridItems.forEach(button => button.classList.remove('gridpicker-option-focused', 'gridpicker-menuitem-highlight'));
        const activeItem = this.gridItems[this.activeDescendantIndex];
        if (!activeItem) return;
        activeItem.classList.add('gridpicker-option-focused');
        if (this.catalogStatus_) this.catalogStatus_.textContent = activeItem.title;

        Blockly.utils.style.scrollIntoContainerView(activeItem, this.scrollContainer);
        const rect = activeItem.getBoundingClientRect();

        if (this.gridTooltip_) {
            const title = activeItem.title || (activeItem as any).alt;
            this.gridTooltip_.textContent = title;

            this.gridTooltip_.style.visibility = title ? 'visible' : 'hidden';
            this.gridTooltip_.style.display = title ? '' : 'none';

            this.gridTooltip_.style.top = `${rect.bottom + 5}px`;
            this.gridTooltip_.style.left = `${rect.left}px`;
        }

        this.addKeyboardNavigableClass();
    }

    /**
     * When disposing the grid picker, make sure the tooltips are disposed too.
     * @public
     */
    public dispose() {
        super.dispose();
        this.disposeGrid();
        this.disposeTooltip();
        this.disposeIntersectionObserver();
    }

    private createTooltip_() {
        if (this.gridTooltip_ || !this.hasImageOptions) return;

        // Create tooltip
        this.gridTooltip_ = document.createElement('div');
        this.gridTooltip_.className = 'blocklyGridPickerTooltip';
        this.gridTooltip_.style.position = 'absolute';
        this.gridTooltip_.style.display = 'none';
        this.gridTooltip_.style.visibility = 'hidden';
        document.body.appendChild(this.gridTooltip_);
    }

    /**
     * Create blocklyGridPickerRows and add them to table container
     * @param options
     * @param tableContainer
     */
    private populateTableContainer(options: (Object | String[])[], tableContainer: HTMLElement, scrollContainer: HTMLElement) {
        this.gridItems = [];
        this.activeDescendantIndex = 0;
        this.selectedItemDom = undefined;
        tableContainer.removeAttribute("aria-activedescendant");
        this.setupIntersectionObserver_();

        pxsim.U.removeChildren(tableContainer);

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
        rowContent.setAttribute('role', 'row');
        rowContent.id = `${this.sourceBlock_.id}:row-${row}`;

        for (let i = (columns * row); i < Math.min((columns * row) + columns, options.length); i++) {
            let content = (options[i] as any)[0]; // Human-readable text or image.
            const value = (options[i] as any)[1]; // Language-neutral value.

            const menuItem = document.createElement('div');
            menuItem.className = 'gridpicker-menuitem gridpicker-option';
            menuItem.setAttribute('id', `${this.sourceBlock_.id}:${i}`); // For aria-activedescendant
            menuItem.setAttribute('role', 'gridcell');
            menuItem.setAttribute('aria-selected', 'false');
            menuItem.style.userSelect = 'none';
            menuItem.title = content['alt'] || content;
            menuItem.setAttribute('data-value', value);

            const menuItemContent = document.createElement('div');
            menuItemContent.setAttribute('class', 'gridpicker-menuitem-content');
            menuItemContent.title = content['alt'] || content;
            menuItemContent.setAttribute('data-value', value);

            const family = this.catalogFamilies_[value];
            if (family) {
                menuItem.classList.add("gridpicker-family");
                menuItem.setAttribute("aria-expanded", String(this.catalogExpanded_.has(family.id)));
                menuItem.title = pxt.Util.lf("{0}: {1} choices", family.name, family.options.length);
                menuItem.setAttribute("aria-label", menuItem.title);
            }


            // Set colour
            let backgroundColour = this.backgroundColour_;
            if (value == this.getValue() || (family && !this.catalogExpanded_.has(family.id) && family.options.some(option => option[1] === this.getValue()))) {
                // This option is selected
                menuItem.setAttribute('aria-selected', 'true');
                this.activeDescendantIndex = i;
                pxt.BrowserUtils.addClass(menuItem, `gridpicker-option-selected ${!this.openingPointerCoords ? 'gridpicker-option-focused' : '' }`);
                tableContainer.setAttribute('aria-activedescendant', menuItem.id);
                backgroundColour = (this.sourceBlock_ as Blockly.BlockSvg).getColourTertiary();

                // Save so we can scroll to it later
                this.selectedItemDom = menuItem;

                if (!this.catalog_ && this.hasImageOptions && !this.shouldShowTooltips()) {
                    this.updateSelectedBar_(content, value);
                }
            }

            if (!this.catalog_) {
                menuItem.style.backgroundColor = backgroundColour;
                menuItem.style.borderColor = this.borderColour_;
            }


            if (typeof content === "object") {
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

            if (family) {
                const disclosure = document.createElement("i");
                disclosure.className = this.catalogExpanded_.has(family.id) ? "gridpicker-family-toggle icon minus" : "gridpicker-family-toggle icon plus";
                disclosure.setAttribute("aria-hidden", "true");
                const count = document.createElement("span");
                count.className = "gridpicker-family-count";
                count.textContent = String(family.options.length);
                menuItem.appendChild(count);
                menuItem.appendChild(disclosure);
            }

            if (this.shouldShowTooltips() || this.catalog_) {
                Blockly.browserEvents.conditionalBind(menuItem, 'click', this, () => this.buttonClickAndClose_(value));

                // Setup hover tooltips
                const xOffset = (this.sourceBlock_.RTL ? -this.tooltipConfig_.xOffset : this.tooltipConfig_.xOffset);
                const yOffset = this.tooltipConfig_.yOffset;

                Blockly.browserEvents.bind(menuItem, 'pointermove', this, (e: PointerEvent) => {
                    if (this.pointerMoveTriggeredByUser()) {
                        this.gridItems.forEach(item => item.classList.remove('gridpicker-option-focused'))
                        this.activeDescendantIndex = i;
                        if (this.catalogStatus_) this.catalogStatus_.textContent = menuItem.title;
                        if (this.gridTooltip_ && this.hasImageOptions) {
                            this.gridTooltip_.style.top = `${e.clientY + yOffset}px`;
                            this.gridTooltip_.style.left = `${e.clientX + xOffset}px`;
                            // Set tooltip text
                            const touchTarget = document.elementFromPoint(e.clientX, e.clientY);
                            const title = (touchTarget as any).title || (touchTarget as any).alt;
                            this.gridTooltip_.textContent = title;
                            // Show the tooltip
                            this.gridTooltip_.style.visibility = title ? 'visible' : 'hidden';
                            this.gridTooltip_.style.display = title ? '' : 'none';
                        }

                        pxt.BrowserUtils.addClass(menuItem, 'gridpicker-menuitem-highlight');
                        tableContainer.setAttribute('aria-activedescendant', menuItem.id);
                    }
                });

                Blockly.browserEvents.bind(menuItem, 'pointerout', this, (e: PointerEvent) => {
                    if (this.pointerOutTriggeredByUser()) {
                        this.gridItems.forEach(item => item.classList.remove('gridpicker-option-focused'))
                        if (this.gridTooltip_ && this.hasImageOptions) {
                            // Hide the tooltip
                            this.gridTooltip_.style.visibility = 'hidden';
                            this.gridTooltip_.style.display = 'none';
                        }

                        pxt.BrowserUtils.removeClass(menuItem, 'gridpicker-menuitem-highlight');
                        tableContainer.removeAttribute('aria-activedescendant');
                        this.activeDescendantIndex = undefined;
                    }
                });
            } else {
                if (this.hasImageOptions) {
                    // Show the selected bar
                    this.selectedBar_.style.display = '';

                    // Show the selected item (in the selected bar)
                    Blockly.browserEvents.conditionalBind(menuItem, 'click', this, (e: MouseEvent) => {
                        if (this.closeModal_) {
                            this.buttonClick_(value);
                        } else {
                            // Clear all current hovers.
                            const currentHovers = tableContainer.getElementsByClassName('gridpicker-menuitem-highlight');
                            for (let i = 0; i < currentHovers.length; i++) {
                                pxt.BrowserUtils.removeClass(currentHovers[i] as HTMLElement, 'gridpicker-menuitem-highlight');
                            }
                            // Set hover on current item
                            pxt.BrowserUtils.addClass(menuItem, 'gridpicker-menuitem-highlight');

                            this.updateSelectedBar_(content, value);
                        }
                    });
                } else {
                    Blockly.browserEvents.conditionalBind(menuItem, 'click', this, () => this.buttonClickAndClose_(value));
                    Blockly.browserEvents.conditionalBind(menuItem, 'mouseup', this, () => this.buttonClickAndClose_(value));
                }
            }

            menuItem.appendChild(menuItemContent);
            this.gridItems.push(menuItem);
            rowContent.appendChild(menuItem);
        }

        return rowContent;
    }

    /**
     * Callback for when a button is clicked inside the drop-down.
     * Should be bound to the FieldIconMenu.
     * @param {string | null} value the value to set for the field
     * @private
     */
    protected buttonClick_ = (value: string | null) => {
        if (value !== null) {
            this.setValue(value);

            // Close the picker
            if (this.closeModal_) {
                this.close();
                this.closeModal_ = false;
            }
        }
    };

    protected buttonClickAndClose_ = (value: string | null) => {
        const family = this.catalogFamilies_[value];
        if (family) {
            if (this.catalogExpanded_.has(family.id)) this.catalogExpanded_.delete(family.id);
            else this.catalogExpanded_.add(family.id);
            this.renderCatalog_();
            const index = this.gridItems.findIndex(item => item.getAttribute("data-value") === value);
            if (index >= 0) {
                this.activeDescendantIndex = index;
                this.setFocusedItem_(this.catalogTable_);
                this.catalogTable_.setAttribute("aria-activedescendant", this.gridItems[index].id);
            }
            this.catalogTable_.focus();
            return;
        }
        this.closeModal_ = true;
        this.buttonClick_(value);
    };

    doClassValidation_(newValue: string) {
        return newValue;
    }

    getFieldDescription(): string {
        return this.getValue();
    }

    /**
     * Closes the gridpicker.
     */
    private close() {
        this.disposeTooltip();
        this.disposeGrid();

        Blockly.WidgetDiv.hideIfOwner(this);
        Blockly.Events.setGroup(false);
        if (this.tabKeyBind) Blockly.browserEvents.unbind(this.tabKeyBind);
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
                    pxt.BrowserUtils.removeClass(menuItem, "gridpicker-menuitem-highlight");
                    pxt.BrowserUtils.removeClass(menuItem, "gridpicker-option-selected");
                }
            }
            let firstItem = menuItemsDom[0].childNodes[0] as HTMLElement;
            firstItem.className += " gridpicker-menuitem-highlight"
        }
    }

    /**
     * Scroll menu to item that equals current value of gridpicker
     */
    private highlightAndScrollSelected(tableContainerDom: HTMLElement, scrollContainerDom: HTMLElement) {
        if (!this.selectedItemDom) return;
        Blockly.utils.style.scrollIntoContainerView(this.selectedItemDom, scrollContainerDom, true);
    }

    /**
     * Create a dropdown menu under the text.
     * @private
     */
    public showEditor_(e?: Event) {
        this.setOpeningPointerCoords(e);

        Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, () => {
            this.onClose_();
        });

        this.setupIntersectionObserver_();

        this.createTooltip_();

        const tableContainer = document.createElement("div");
        this.positionMenu_(tableContainer);
        tableContainer.focus();
        if (!e) {
            this.addKeyboardNavigableClass();
        }
        this.getFocusableElement().ariaExpanded = 'true';
    }

    private positionMenu_(tableContainer: HTMLElement) {
        // Record viewport dimensions before adding the dropdown.
        const viewportBBox = Blockly.utils.svgMath.getViewportBBox();
        const anchorBBox = this.getAnchorDimensions_();

        const { paddingContainer, scrollContainer } = this.createWidget_(tableContainer);
        this.scrollContainer = scrollContainer;

        if (this.catalog_) {
            this.positionCatalog_();
            this.highlightAndScrollSelected(tableContainer, scrollContainer);
            return;
        }

        const containerSize = {
            width: paddingContainer.offsetWidth,
            height: paddingContainer.offsetHeight
        };
        const windowHeight = window.outerHeight || window.innerHeight;

        // Set width
        if (this.width_) {
            const windowWidth = window.outerWidth || window.innerWidth;
            if (this.width_ > windowWidth) {
                this.width_ = windowWidth;
            }
            tableContainer.style.width = this.width_ + 'px';
        }

        let addedHeight = 0;
        if (this.hasSearchBar_) addedHeight += 50; // Account for search bar
        if (this.selectedBar_) addedHeight += 50; // Account for the selected bar

        // Set height
        if (this.maxRows_ && tableContainer.children.length) {
            // Calculate height
            const firstRowDom = tableContainer.children[0] as HTMLElement;
            const rowHeight = firstRowDom.offsetHeight;
            // Compute maxHeight using maxRows + 0.3 to partially show next row, to hint at scrolling
            let maxHeight = rowHeight * (this.maxRows_ + 0.3);
            if (windowHeight < (maxHeight + addedHeight)) {
                maxHeight = windowHeight - addedHeight;
            }
            if (containerSize.height > maxHeight) {
                scrollContainer.style.overflowY = "auto";
                scrollContainer.style.height = maxHeight + "px";
                containerSize.height = maxHeight;
            }
        }

        containerSize.height += addedHeight;

        // Position the menu.
        Blockly.WidgetDiv.positionWithAnchor(viewportBBox, anchorBBox, containerSize,
            this.sourceBlock_.RTL);


        this.highlightAndScrollSelected(tableContainer, scrollContainer)
    };

    private shouldShowTooltips() {
        return !pxt.BrowserUtils.isMobile();
    }

    private getAnchorDimensions_() {
        const boundingBox = this.getScaledBBox() as any;
        if (this.sourceBlock_.RTL) {
            boundingBox.right += FieldBase.CHECKMARK_OVERHANG;
        } else {
            boundingBox.left -= FieldBase.CHECKMARK_OVERHANG;
        }
        return boundingBox;
    };

    private createWidget_(tableContainer: HTMLElement) {
        const widgetDiv = Blockly.WidgetDiv.getDiv();

        const options = filterGridPickerOptions(this.getOptions(), this.filter_, this.optionTags_);

        // Container for the menu rows
        tableContainer.setAttribute('role', 'grid');
        tableContainer.setAttribute('tabindex', '0');

        this.addPointerListener(widgetDiv);
        this.addKeyDownHandler(tableContainer);

        // Container used to limit the height of the tableContainer, because the tableContainer uses
        // display: table, which ignores height and maxHeight
        const scrollContainer = document.createElement("div");

        // Needed to correctly style borders and padding around the scrollContainer, because the padding around the
        // scrollContainer is part of the scrollable area and will not be correctly shown at the top and bottom
        // when scrolling
        const paddingContainer = document.createElement("div");
        if (!this.catalog_) {
            paddingContainer.style.border = `solid 1px ${this.borderColour_}`;
            tableContainer.style.backgroundColor = this.backgroundColour_;
            scrollContainer.style.backgroundColor = this.backgroundColour_;
            paddingContainer.style.backgroundColor = this.backgroundColour_;
        }

        tableContainer.className = 'blocklyGridPickerMenu';
        scrollContainer.className = 'blocklyGridPickerScroller';
        paddingContainer.className = 'blocklyGridPickerPadder';

        paddingContainer.appendChild(scrollContainer);
        scrollContainer.appendChild(tableContainer);
        widgetDiv.appendChild(paddingContainer);

        if (this.catalog_) {
            this.scrollContainer = scrollContainer;
            this.createCatalog_(paddingContainer, tableContainer);
            return { paddingContainer, scrollContainer };
        }

        // Search bar
        let searchBar: HTMLDivElement | undefined;
        if (this.hasSearchBar_) {
            const { searchBarDiv, searchBar: input } = this.createSearchBar_(tableContainer, scrollContainer, options);
            paddingContainer.insertBefore(searchBarDiv, paddingContainer.childNodes[0]);
            searchBar = input;
        }

        // Selected bar
        let cancelButton: HTMLButtonElement | undefined;
        if (!this.shouldShowTooltips()) {
            const { selectedBar, cancelButton: buttton } = this.createSelectedBar_();
            this.selectedBar_ = selectedBar;
            cancelButton = buttton;
            paddingContainer.appendChild(this.selectedBar_);
        }

        // Render elements
        this.populateTableContainer(options, tableContainer, scrollContainer);

        if (this.hasSearchBar_ || this.selectedBar_) {
            this.firstFocusableElement = searchBar || tableContainer;
            this.lastFocusableElement = cancelButton || tableContainer;
            this.tabKeyBind = Blockly.browserEvents.bind(widgetDiv, "keydown", this, this.handleTabKey.bind(this));
        }

        return { paddingContainer, scrollContainer };
    }

    private catalogIcon_(reference: string): string {
        return this.blocksInfo_?.apis.jres?.[reference]?.icon
            || this.blocksInfo_?.apis.byQName[reference]?.attributes.iconURL;
    }

    private createCatalog_(container: HTMLElement, table: HTMLElement): void {
        this.catalogContainer_ = container;
        this.catalogTable_ = table;
        container.classList.add("blocklyGridPickerCatalog");
        container.setAttribute("role", "dialog");
        container.setAttribute("aria-label", pxt.Util.rlf(this.catalog_.name));
        container.id = `${this.sourceBlock_.id}:catalog`;
        table.setAttribute("aria-label", pxt.Util.lf("Available assets"));
        const parentWidth = Blockly.WidgetDiv.getDiv().parentElement.getBoundingClientRect().width || window.innerWidth;
        const width = Math.min(this.width_ || 544, Math.max(144, Math.min(parentWidth, window.innerWidth) - 24));
        container.style.width = `${width}px`;
        this.columns_ = Math.max(1, Math.min(this.catalogColumns_, Math.floor((width - 24) / 52)));
        container.style.setProperty("--gridpicker-columns", String(this.columns_));

        const tabs = document.createElement("div");
        tabs.className = "gridpicker-catalog-tabs";
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", pxt.Util.lf("Asset categories"));
        this.catalogTabs_ = [];
        const selected = this.getOptions().find(option => option[1] === this.getValue());
        if (!this.catalogTab_) this.catalogTab_ = this.catalog_.tabs.find(tab =>
            !tab.flat && !tab.materials && (!selected || filterGridPickerOptions([selected], tab.tags || [], this.optionTags_).length)
        )?.id || this.catalog_.tabs[0].id;
        for (const tab of this.catalog_.tabs) {
            const button = document.createElement("button");
            button.type = "button";
            button.id = `${container.id}:tab:${tab.id}`;
            button.setAttribute("role", "tab");
            button.setAttribute("aria-controls", `${container.id}:panel`);
            button.setAttribute("aria-label", pxt.Util.rlf(tab.name));
            button.title = pxt.Util.rlf(tab.name);
            const icon = this.catalogIcon_(tab.icon);
            if (icon) {
                const image = document.createElement("img");
                image.src = icon;
                image.alt = "";
                image.draggable = false;
                button.appendChild(image);
            } else if (tab.flat) {
                const search = document.createElement("i");
                search.className = "icon search";
                search.setAttribute("aria-hidden", "true");
                button.appendChild(search);
            } else {
                const label = document.createElement("span");
                label.textContent = pxt.Util.rlf(tab.name);
                button.appendChild(label);
            }
            button.addEventListener("click", () => this.selectCatalogTab_(tab.id));
            button.addEventListener("keydown", event => {
                const index = this.catalogTabs_.indexOf(button);
                let next = index;
                if (event.key === "ArrowRight") next = (index + (this.sourceBlock_.RTL ? -1 : 1) + this.catalogTabs_.length) % this.catalogTabs_.length;
                else if (event.key === "ArrowLeft") next = (index + (this.sourceBlock_.RTL ? 1 : -1) + this.catalogTabs_.length) % this.catalogTabs_.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = this.catalogTabs_.length - 1;
                else return;
                event.preventDefault();
                this.selectCatalogTab_(this.catalog_.tabs[next].id);
                this.catalogTabs_[next].focus();
            });
            this.catalogTabs_.push(button);
            tabs.appendChild(button);
        }
        container.insertBefore(tabs, this.scrollContainer);

        const toolbar = document.createElement("div");
        toolbar.className = "gridpicker-catalog-toolbar";
        const title = document.createElement("div");
        title.className = "gridpicker-catalog-title";
        title.id = `${container.id}:title`;
        toolbar.appendChild(title);
        const search = document.createElement("input");
        search.type = "search";
        search.autocomplete = "off";
        search.spellcheck = false;
        search.value = this.catalogSearch_;
        search.placeholder = pxt.Util.lf("Search");
        search.setAttribute("aria-label", pxt.Util.lf("Search assets"));
        search.addEventListener("input", () => {
            this.catalogSearch_ = search.value;
            this.renderCatalog_();
        });
        search.addEventListener("keydown", event => {
            if (event.key === "ArrowDown" && this.gridItems.length) {
                this.activeDescendantIndex = 0;
                this.setFocusedItem_(table);
                table.setAttribute("aria-activedescendant", this.gridItems[0].id);
                table.focus();
                event.preventDefault();
            } else if (event.key === "Enter" && this.gridItems.length) {
                this.buttonClickAndClose_(this.gridItems[0].getAttribute("data-value"));
                event.preventDefault();
            }
        });
        toolbar.appendChild(search);
        container.insertBefore(toolbar, this.scrollContainer);

        const filters = document.createElement("div");
        filters.className = "gridpicker-catalog-filters";
        const createFilter = (label: string, entries: pxt.GridPickerCategory[], change: (value: string) => void): HTMLSelectElement => {
            const wrapper = document.createElement("label");
            const text = document.createElement("span");
            text.textContent = label;
            wrapper.appendChild(text);
            const select = document.createElement("select");
            select.setAttribute("aria-label", label);
            const all = document.createElement("option");
            all.value = "";
            all.textContent = pxt.Util.lf("All");
            select.appendChild(all);
            for (const entry of entries) {
                const option = document.createElement("option");
                option.value = (entry.tags || []).join(" ");
                option.textContent = pxt.Util.rlf(entry.name);
                select.appendChild(option);
            }
            select.addEventListener("change", () => change(select.value));
            wrapper.appendChild(select);
            filters.appendChild(wrapper);
            return select;
        };
        if (this.catalog_.filters?.length) {
            const select = createFilter(pxt.Util.lf("Tags"), this.catalog_.filters, value => {
                this.catalogFilter_ = value;
                this.renderCatalog_();
            });
            select.value = this.catalogFilter_;
        }
        container.insertBefore(filters, this.scrollContainer);
        this.scrollContainer.id = `${container.id}:panel`;
        this.scrollContainer.setAttribute("role", "tabpanel");
        this.catalogContentHeight_ = undefined;
        this.catalogAnchor_ = undefined;

        const footer = document.createElement("div");
        footer.className = "gridpicker-catalog-footer";
        this.catalogStatus_ = document.createElement("span");
        this.catalogStatus_.setAttribute("role", "status");
        this.catalogStatus_.setAttribute("aria-live", "polite");
        footer.appendChild(this.catalogStatus_);
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", pxt.Util.lf("Close"));
        close.title = pxt.Util.lf("Close");
        const closeIcon = document.createElement("i");
        closeIcon.className = "icon cancel";
        closeIcon.setAttribute("aria-hidden", "true");
        close.appendChild(closeIcon);
        close.addEventListener("click", () => this.close());
        footer.appendChild(close);
        container.appendChild(footer);
        container.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                this.close();
                event.preventDefault();
                event.stopPropagation();
            }
        });
        this.lastFocusableElement = close;
        this.tabKeyBind = Blockly.browserEvents.bind(container, "keydown", this, this.handleTabKey.bind(this));
        this.renderCatalog_();
        if (typeof ResizeObserver !== "undefined") {
            this.catalogResizeObserver_ = new ResizeObserver(() => {
                this.catalogAnchor_ = undefined;
                this.positionCatalog_();
            });
            this.catalogResizeObserver_.observe(Blockly.WidgetDiv.getDiv().parentElement);
        }
    }

    private selectCatalogTab_(id: string): void {
        this.catalogTab_ = id;
        this.catalogExpanded_.clear();
        this.renderCatalog_();
    }

    private renderCatalog_(): void {
        const tab = this.catalog_.tabs.find(entry => entry.id === this.catalogTab_) || this.catalog_.tabs[0];
        this.catalogTabs_.forEach((button, index) => {
            const active = this.catalog_.tabs[index].id === tab.id;
            button.setAttribute("aria-selected", String(active));
            button.tabIndex = active ? 0 : -1;
            if (active) this.firstFocusableElement = button;
        });
        this.scrollContainer.setAttribute("aria-labelledby", `${this.catalogContainer_.id}:tab:${tab.id}`);
        this.catalogContainer_.querySelector(".gridpicker-catalog-title").textContent = pxt.Util.rlf(tab.name);
        const options = filterGridPickerOptions(this.getOptions(), this.filter_, this.optionTags_);
        const groups = getGridPickerGroups(options, this.catalog_, tab, this.catalogSearch_, this.catalogFilter_, this.optionTags_);
        const visible: Blockly.MenuOption[] = [];
        this.catalogFamilies_ = {};
        const choices = new Set<string>();
        for (const group of groups) {
            group.options.forEach(option => choices.add(option[1]));
            if ((group.id !== "other" || tab.materials) && (group.options.length > 1 || tab.materials) && !tab.flat && !this.catalogSearch_.trim()) {
                const representative = group.options.find(option => option[1] === this.getValue()) || group.options[0];
                const value = `@family:${group.id}`;
                this.catalogFamilies_[value] = group;
                const icon = this.catalogIcon_(group.icon);
                visible.push([icon ? { src: icon, alt: pxt.Util.rlf(group.name), width: 36, height: 36 } : representative[0], value]);
                if (this.catalogExpanded_.has(group.id)) visible.push(...group.options);
            } else visible.push(...group.options);
        }
        this.populateTableContainer(visible, this.catalogTable_, this.scrollContainer);
        if (!visible.length) {
            const empty = document.createElement("div");
            empty.className = "gridpicker-catalog-empty";
            empty.textContent = pxt.Util.lf("No matching assets");
            this.catalogTable_.appendChild(empty);
        }
        this.catalogStatus_.textContent = pxt.Util.lf("{0} choices", choices.size);
        if (this.gridTooltip_) {
            this.gridTooltip_.style.display = "none";
            this.gridTooltip_.style.visibility = "hidden";
        }
        this.positionCatalog_();
    }

    private positionCatalog_(): void {
        if (!this.catalogContainer_ || !this.scrollContainer) return;
        const parent = Blockly.WidgetDiv.getDiv().parentElement.getBoundingClientRect();
        this.catalogContainer_.classList.toggle("gridpicker-catalog-compact", parent.height < 360);
        const width = Math.min(this.width_ || 544, Math.max(144, Math.min(parent.width, window.innerWidth) - 24));
        this.catalogContainer_.style.width = `${width}px`;
        const columns = Math.max(1, Math.min(this.catalogColumns_, Math.floor((width - 24) / 52)));
        if (columns !== this.columns_) {
            this.columns_ = columns;
            this.catalogContainer_.style.setProperty("--gridpicker-columns", String(columns));
            this.catalogContentHeight_ = undefined;
            this.renderCatalog_();
            return;
        }
        if (this.catalogContentHeight_ === undefined) {
            this.catalogFamilies_ = {};
            const allowed = filterGridPickerOptions(this.getOptions(), this.filter_, this.optionTags_);
            this.populateTableContainer(getGridPickerSizeOptions(allowed, this.catalog_, this.optionTags_), this.catalogTable_, this.scrollContainer);
            this.catalogContentHeight_ = this.catalogTable_.offsetHeight;
            this.renderCatalog_();
            return;
        }
        const viewport = new Blockly.utils.Rect(
            Math.max(8, parent.top + 8),
            Math.min(window.innerHeight - 8, parent.bottom - 8),
            Math.max(8, parent.left + 8),
            Math.min(window.innerWidth - 8, parent.right - 8)
        );
        const chrome = this.catalogContainer_.offsetHeight - this.scrollContainer.offsetHeight;
        const heightLimit = Math.min(420, Math.max(48, viewport.bottom - viewport.top - chrome - 2));
        this.scrollContainer.style.height = `${Math.min(this.catalogContentHeight_, heightLimit)}px`;
        this.scrollContainer.style.overflowY = "auto";
        if (!this.catalogAnchor_) this.catalogAnchor_ = this.getAnchorDimensions_();
        let anchor = this.catalogAnchor_;
        const height = this.catalogContainer_.offsetHeight;
        if (anchor.bottom + height >= viewport.bottom && anchor.top - height < viewport.top) {
            anchor = new Blockly.utils.Rect(viewport.top, viewport.top, anchor.left, anchor.right);
        }
        Blockly.WidgetDiv.positionWithAnchor(viewport, anchor, {
            width: this.catalogContainer_.offsetWidth,
            height
        }, this.sourceBlock_.RTL);
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
        searchBar.setAttribute("tabindex", "0");
        searchBar.addEventListener("click", () => {
            searchBar.focus();
            searchBar.setSelectionRange(0, searchBar.value.length);
        });

        let lastSearch = "";

        // Search on key change
        searchBar.addEventListener("keyup", pxt.Util.debounce((e: KeyboardEvent) => {
            if (e.code === "Tab") {
                return;
            }

            let text = pxt.U.escapeForRegex(searchBar.value);
            if (text === lastSearch) {
                return;
            }
            lastSearch = text;
            let re = new RegExp(text, "i");
            let filteredOptions = options.filter((block) => {
                const alt = (block as any)[0].alt; // Human-readable text or image.
                const value = (block as any)[1]; // Language-neutral value.
                return alt ? re.test(alt) : re.test(value);
            })
            this.populateTableContainer(filteredOptions, tableContainer, scrollContainer);
            if (text) {
                this.highlightFirstItem(tableContainer)
            } else {
                this.highlightAndScrollSelected(tableContainer, scrollContainer)
            }
            // Hide the tooltip
            if (this.gridTooltip_) {
                this.gridTooltip_.style.visibility = 'hidden';
                this.gridTooltip_.style.display = 'none';
            }
        }, 300, false));

        // Select the first item if the enter key is pressed
        searchBar.addEventListener("keyup", (e: KeyboardEvent) => {
            if (e.code === "Enter") {
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

        return { searchBarDiv, searchBar };
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

        Blockly.browserEvents.conditionalBind(selectButton, 'click', this, () => {
            this.setValue(this.selectedBarValue_);
            this.close();
        });

        const cancelButton = document.createElement("button");
        cancelButton.className = "ui button icon red";
        const cancelButtonIcon = document.createElement("i");
        cancelButtonIcon.className = 'icon cancel';
        cancelButton.appendChild(cancelButtonIcon);

        Blockly.browserEvents.conditionalBind(cancelButton, 'click', this, () => {
            this.close();
        });

        buttonsDiv.appendChild(selectButton);
        buttonsDiv.appendChild(cancelButton);

        selectedBar.appendChild(selectedWrapper);
        selectedBar.appendChild(buttonsWrapper);
        return { selectedBar, cancelButton };
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
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Disposes the tooltip DOM.
     * @private
     */
    private disposeTooltip() {
        if (this.gridTooltip_) {
            pxsim.U.remove(this.gridTooltip_);
            this.gridTooltip_ = null;
        }
    }

    private onClose_() {
        this.disposeTooltip();
        this.disposeIntersectionObserver();
        if (this.catalogResizeObserver_) this.catalogResizeObserver_.disconnect();
        this.catalogResizeObserver_ = undefined;
        this.disposeGrid();
        if (this.tabKeyBind) Blockly.browserEvents.unbind(this.tabKeyBind);
        this.tabKeyBind = null;
        this.catalogTable_ = undefined;
        this.catalogContainer_ = undefined;
        this.catalogStatus_ = undefined;
        this.catalogTabs_ = [];
        this.catalogContentHeight_ = undefined;
        this.catalogAnchor_ = undefined;
        this.catalogFamilies_ = {};
        this.scrollContainer = undefined;
        this.getFocusableElement().ariaExpanded = 'false';
    }

    // Used for focus trap
    private handleTabKey(e: KeyboardEvent) {
        if (e.code === "Tab") {
            this.addKeyboardNavigableClass();
            if (document.activeElement === this.lastFocusableElement && !e.shiftKey) {
                this.firstFocusableElement.focus();
                e.preventDefault();
            } else if (document.activeElement === this.firstFocusableElement && e.shiftKey) {
                this.lastFocusableElement.focus();
                e.preventDefault();
            }
        }
    }

    private addKeyboardNavigableClass() {
        if (this.scrollContainer) {
            this.scrollContainer.classList.add("keyboardNavigable");
        }
    }
}

Blockly.Css.register(`
.blocklyWidgetDiv .blocklyGridPickerCatalog {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: 1px solid var(--pxt-neutral-stencil2);
    background: var(--pxt-neutral-background2);
    color: var(--pxt-neutral-foreground2);
    font-family: var(--pxt-page-font);
    border-radius: 4px;
    padding: 8px;
    gap: 8px;
}

.blocklyGridPickerCatalog button,
.blocklyGridPickerCatalog input,
.blocklyGridPickerCatalog select {
    box-sizing: border-box;
    font: inherit;
    color: var(--pxt-neutral-foreground1);
    background: var(--pxt-neutral-background1);
    border: 1px solid var(--pxt-neutral-stencil1);
    border-radius: 2px;
    min-height: 36px;
}

.blocklyGridPickerCatalog button {
    cursor: pointer;
}

.blocklyGridPickerCatalog button:focus-visible,
.blocklyGridPickerCatalog input:focus-visible,
.blocklyGridPickerCatalog select:focus-visible {
    outline: 3px solid var(--pxt-focus-border);
    outline-offset: 1px;
}

.blocklyGridPickerCatalog .gridpicker-catalog-tabs {
    display: flex;
    flex: none;
    gap: 6px;
    overflow-x: auto;
    padding: 3px;
}

.gridpicker-catalog-tabs button {
    flex: 0 0 auto;
    min-width: 44px;
    height: 44px;
    padding: 4px 8px;
}

.gridpicker-catalog-tabs button[aria-selected="true"] {
    background: var(--pxt-target-background1);
    color: var(--pxt-target-foreground1);
    border-color: var(--pxt-focus-border);
    box-shadow: inset 0 -3px 0 var(--pxt-focus-border);
}

.gridpicker-catalog-tabs img {
    width: 28px;
    height: 28px;
    object-fit: contain;
    vertical-align: middle;
}

.gridpicker-catalog-toolbar {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.gridpicker-catalog-title {
    font-size: 16px;
    font-weight: bold;
    overflow-wrap: anywhere;
}

.gridpicker-catalog-toolbar input {
    width: 100%;
    padding: 6px 10px;
}

.gridpicker-catalog-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.gridpicker-catalog-filters:empty,
.gridpicker-catalog-filters label[hidden] {
    display: none;
}

.gridpicker-catalog-filters label {
    display: flex;
    flex: 1 1 120px;
    align-items: center;
    gap: 6px;
}

.gridpicker-catalog-filters select {
    flex: 1;
    min-width: 0;
    padding: 4px;
}

.blocklyGridPickerCatalog .blocklyGridPickerScroller {
    padding: 4px;
    border-radius: 2px;
    background: var(--pxt-neutral-background2);
    min-height: 52px;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu {
    display: block;
    border-spacing: 0;
    background: transparent;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerRow {
    display: grid;
    grid-template-columns: repeat(var(--gridpicker-columns), minmax(0, 1fr));
    gap: 6px;
    margin-bottom: 6px;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu .gridpicker-option {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-height: 48px;
    padding: 4px;
    border: 1px solid var(--pxt-neutral-stencil1);
    border-radius: 2px;
    background: var(--pxt-neutral-background1);
    color: var(--pxt-neutral-foreground1);
}

.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu .gridpicker-menuitem-content {
    color: inherit;
    min-width: 0;
    overflow-wrap: anywhere;
}

.blocklyGridPickerCatalog .gridpicker-menuitem-content img {
    width: 36px;
    height: 36px;
    max-width: 100%;
    object-fit: contain;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu .gridpicker-option-selected,
.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu .gridpicker-menuitem-highlight,
.blocklyWidgetDiv .blocklyGridPickerCatalog .blocklyGridPickerMenu .gridpicker-option-focused {
    background: var(--pxt-neutral-background1-hover);
    color: var(--pxt-neutral-foreground1-hover);
    outline: 3px solid var(--pxt-focus-border);
    outline-offset: -2px;
    box-shadow: none;
}

.gridpicker-family > .gridpicker-family-toggle {
    position: absolute;
    inset-inline-end: 2px;
    bottom: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    pointer-events: none;
    color: var(--pxt-neutral-foreground1);
    background: var(--pxt-neutral-background1);
}

.gridpicker-family > .gridpicker-family-toggle::before {
    display: block;
    line-height: 1;
}

.gridpicker-family-count {
    position: absolute;
    inset-inline-start: 2px;
    top: 1px;
    font-size: 10px;
    line-height: 12px;
    color: var(--pxt-neutral-foreground1);
    background: var(--pxt-neutral-background1);
}

.gridpicker-catalog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
}

.gridpicker-catalog-footer > span {
    min-width: 0;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gridpicker-catalog-footer button {
    flex: none;
    width: 36px;
    padding: 4px;
}

.gridpicker-catalog-footer .icon {
    margin: 0;
}

.gridpicker-catalog-empty {
    padding: 24px 8px;
    text-align: center;
    color: var(--pxt-neutral-foreground2);
}

.blocklyWidgetDiv .blocklyGridPickerCatalog.gridpicker-catalog-compact {
    padding: 4px;
    gap: 4px;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-tabs button {
    min-width: 36px;
    height: 36px;
    padding: 2px;
}

.blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-tabs img {
    width: 24px;
    height: 24px;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-title {
    font-size: 14px;
}

.blocklyWidgetDiv .blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-toolbar input,
.blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-footer,
.blocklyGridPickerCatalog.gridpicker-catalog-compact .gridpicker-catalog-footer button {
    min-height: 28px;
}

.blocklyGridPickerTooltip {
    z-index: 995;
}

.blocklyGridPickerPadder {
    outline: none;
    box-shadow: 0px 0px 8px 1px rgba(0, 0, 0, .3)
}

.blocklyWidgetDiv .blocklyGridPickerRow {
    display: table-row;
}

.blocklyWidgetDiv .blocklyGridPickerMenu {
    display: table;
    outline: none;
    border-spacing: 7px;
}

.blocklyGridPickerScroller {
    outline: none;
    padding: 4px;
    border-radius: 4px;
    position: relative;
    -webkit-overflow-scrolling: touch;
}

.blocklyGridPickerScroller.keyboardNavigable:has(:focus-visible) {
    outline: 4px solid var(--pxt-focus-border);
}

.blocklyGridPickerPadder {
    border-radius: 4px;
    outline: none;
    position: relative;
}

.blocklyGridPickerPadder .ui.input i.search.icon {
    margin-top: -0.2rem;
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-menuitem {
    background: white;
    cursor: pointer;
    min-width: unset;
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-menuitem-highlight, .blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-menuitem-hover {
    background: #d6e9f8;
    box-shadow: 0px 0px 0px 4px rgba(255, 255, 255, 0.2);
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-option {
    border: solid 1px black;
    border-radius: 4px;
    color: #fff;
    font-size: 12pt;
    font-weight: bold;
    display: table-cell;
    padding: 8px;
    text-align: center;
    vertical-align: top;
    -webkit-user-select: none;
    -moz-user-select: -moz-none;
    -ms-user-select: none;
        user-select: none;
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-menuitem-content {
    color: #fff;
    font-size: 13px;
    font-family: var(--pxt-page-font);
}

.blocklyWidgetDiv .blocklyGridPickerMenu .floatLeft {
    float: left;
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-option.gridpicker-option-selected {
    position: relative;
}

.blocklyWidgetDiv .blocklyGridPickerMenu .gridpicker-menuitem .gridpicker-menuitem-checkbox {
    display: none;
}

.blocklyWidgetDiv .blocklyGridPickerMenu:focus .blocklyGridPickerRow .gridpicker-menuitem.gridpicker-option-focused {
    outline: 3px solid var(--pxt-focus-border);
}

.blocklyGridPickerTooltip {
    z-index: 995;
}

.blocklyGridPickerSelectedBar {
    display: flex;
    padding-top: 5px;
    justify-content: space-between;
}

.blocklyGridPickerSelectedImage {
    padding: 3px;
    display: inline-block;
    vertical-align: middle;
}

.ui.input input.blocklyGridPickerSearchBar {
    background: none;
    border: none;
    color: white;
}

.ui.input input.blocklyGridPickerSearchBar::placeholder {
    color: white;
}

.ui.input input.blocklyGridPickerSearchBar::-webkit-input-placeholder {
    color: white;
}

.ui.input input.blocklyGridPickerSearchBar::-moz-placeholder {
    color: white;
}

.ui.input input.blocklyGridPickerSearchBar:-ms-input-placeholder {
    color: white;
}

.ui.input input.blocklyGridPickerSearchBar:-moz-placeholder {
    color: white;
}
`);