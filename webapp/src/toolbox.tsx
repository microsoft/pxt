/// <reference path="../../localtypings/pxtarget.d.ts" />

import * as React from "react"
import * as data from "./data"
import * as editor from "./toolboxeditor"
import * as sui from "./sui"
import * as core from "./core"
import * as snippets from "./monacoSnippets"
import * as monaco from "./monaco"

import Util = pxt.Util;

// this is a supertype of pxtc.SymbolInfo (see partitionBlocks)
export interface BlockDefinition {
    name: string;
    type?: string;
    snippet?: string;
    snippetName?: string;
    snippetOnly?: boolean;
    attributes: {
        block?: string;
        blockId?: string;
        blockNamespace?: string;
        color?: string;
        weight?: number;
        advanced?: boolean;
        jsDoc?: string;
        blockBuiltin?: boolean;
        deprecated?: boolean;
        blockHidden?: boolean;
        group?: string;
        subcategory?: string;
    };
    noNamespace?: boolean;
    retType?: string;
    blockXml?: string;
    builtinBlock?: boolean;
    builtinField?: [string, string];
}

export interface ButtonDefinition {
    name: string;
    type: "button";
    attributes: {
        blockId?: string;
        label?: string;
        weight?: number;
    }
    callback?: () => void;
    noNamespace?: boolean;
}

export interface BuiltinCategoryDefinition {
    name: string;
    nameid: string;
    blocks: (BlockDefinition | ButtonDefinition)[];
    //icon?: string;
    groups?: string[];
    attributes: pxtc.CommentAttrs;
    removed?: boolean;
    custom?: boolean; // Only add blocks defined in .blocks and don't query nsMap for more
    customClick?: (theEditor: editor.ToolboxEditor) => boolean; // custom handler
}

export interface Flyout {
    show(): void;
    hide(): void;
}

export interface ToolboxProps {
    editorname: string;
    parent: editor.ToolboxEditor;
}

export interface ToolboxState {
    showAdvanced?: boolean;
    visible?: boolean;
    loading?: boolean;
    selectedItem?: string;
    expandedItem?: string;
    height?: number;

    categories?: ToolboxCategory[];
    showSearchBox?: boolean;

    hasSearch?: boolean;
    focusSearch?: boolean;
    searchBlocks?: pxtc.service.SearchInfo[]; // block ids

    clientWidth?: number;
}

export class Toolbox extends data.Component<ToolboxProps, ToolboxState> {

    private rootElement: HTMLElement;

    private selectedItem: CategoryItem;
    private selectedIndex: number;
    private items: ToolboxCategory[];

    constructor(props: ToolboxProps) {
        super(props);
        this.state = {
            categories: [],
            visible: false,
            loading: false,
            showAdvanced: false
        }
    }

    getElement() {
        return this.rootElement;
    }

    hide() {
        this.setState({ visible: false })
    }

    showLoading() {
        this.setState({ visible: true, loading: true });
    }

    show() {
        this.setState({ visible: true })
    }

    setSelectedItem(item: CategoryItem) {
        this.selectedItem = item;
    }

    setPreviousItem() {
        if (this.selectedIndex > 0) {
            const newIndex = --this.selectedIndex;
            this.setSelection(this.items[newIndex], newIndex);
        } else if (this.state.showSearchBox) {
            // Focus the search box if it exists
            const searchBox = this.refs.searchbox as ToolboxSearch;
            if (searchBox) searchBox.focus();
        }
    }

    setNextItem() {
        if (this.items.length - 1 > this.selectedIndex) {
            const newIndex = ++this.selectedIndex;
            this.setSelection(this.items[newIndex], newIndex);
        }
    }

    setSearch() {
        // Focus the search box if it exists
        const searchBox = this.refs.searchbox as ToolboxSearch;
        if (searchBox) searchBox.focus();
    }

    clear() {
        this.clearSelection();
        this.selectedIndex = 0;
    }

    clearSelection() {
        this.setState({ selectedItem: undefined, expandedItem: undefined, focusSearch: false })
    }

    clearSearch() {
        this.setState({ hasSearch: false, searchBlocks: undefined, focusSearch: false });
    }

    setSelection(treeRow: ToolboxCategory, index: number, force?: boolean) {
        const { editorname, parent } = this.props;
        const { nameid, subns, customClick } = treeRow;

        pxt.tickEvent(`${editorname}.toolbox.click`, undefined, { interactiveConsent: true });

        let id = subns ? nameid + subns : nameid;

        if (this.state.selectedItem == id && !force) {
            this.clearSelection();

            // Hide flyout
            this.closeFlyout();
        } else {
            let handled = false;
            if (customClick) {
                handled = customClick(parent);
                if (handled) return;
            }

            if (!handled) {
                this.setState({ selectedItem: id, expandedItem: nameid, focusSearch: false })
                this.selectedIndex = index;
                if (treeRow.advanced && !this.state.showAdvanced) this.showAdvanced();

                if (!customClick) {
                    // Show flyout
                    this.showFlyout(treeRow);
                }
            }
        }
    }

    focus() {
        if (!this.rootElement) return;
        if (this.selectedItem && this.selectedItem.getTreeRow()) {
            // Focus the selected item
            const selectedItem = this.selectedItem.props.treeRow;
            const selectedItemIndex = this.items.indexOf(selectedItem);
            this.setSelection(selectedItem, selectedItemIndex, true);
        } else {
            // Focus first item in the toolbox
            this.selectFirstItem();
        }
    }

    selectFirstItem() {
        if (this.items[0]) {
            this.setSelection(this.items[0], 0, true);
        }
    }

    moveFocusToFlyout() {
        const { parent } = this.props;
        parent.moveFocusToFlyout();
    }

    componentDidUpdate(prevProps: ToolboxProps, prevState: ToolboxState) {
        if (prevState.visible != this.state.visible
            || prevState.loading != this.state.loading
            || prevState.showAdvanced != this.state.showAdvanced) {
            this.props.parent.resize();
        }
        if (this.state.hasSearch && this.state.searchBlocks != prevState.searchBlocks) {
            // Referesh search items
            this.refreshSearchItem();
        } else if (prevState.hasSearch && !this.state.hasSearch && this.state.selectedItem == 'search') {
            // No more search
            this.closeFlyout();
        }
    }

    advancedClicked() {
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.advanced`, undefined, { interactiveConsent: true });
        this.showAdvanced();
    }

    showAdvanced() {
        const { parent } = this.props;
        if (this.selectedItem && this.selectedItem.props.treeRow
            && this.selectedItem.props.treeRow.advanced) {
            this.clear();
            this.closeFlyout();
        }
        this.setState({ showAdvanced: !this.state.showAdvanced });
    }

    getSearchBlocks(): BlockDefinition[] {
        const { parent } = this.props;
        const { searchBlocks } = this.state;
        return searchBlocks.map(searchResult => {
            return {
                name: searchResult.qName,
                attributes: {
                    blockId: searchResult.id
                },
                builtinBlock: searchResult.builtinBlock,
                builtinField: searchResult.field
            }
        });
    }

    refreshSelection() {
        const { parent } = this.props;
        if (!this.state.selectedItem) return;
        const treeRow = this.items[this.selectedIndex];
        if (treeRow.customClick) {
            treeRow.customClick(parent);
        } else {
            this.showFlyout(treeRow);
        }
    }

    refreshSearchItem() {
        const searchTreeRow = ToolboxSearch.getSearchTreeRow();
        this.showFlyout(searchTreeRow);
    }

    private showFlyout(treeRow: ToolboxCategory) {
        const { parent } = this.props;
        const t0 = performance.now();
        parent.showFlyout(treeRow);
        const t1 = performance.now();
        pxt.debug("perf: call to showFlyout took " + (t1 - t0) + " milliseconds.");
    }

    closeFlyout() {
        const { parent } = this.props;
        parent.closeFlyout();
    }

    hasAdvancedCategories() {
        const { categories } = this.state;
        return categories.some(category => category.advanced);
    }

    getNonAdvancedCategories() {
        const { categories } = this.state;
        return categories.filter(category => !category.advanced);
    }

    getAdvancedCategories() {
        const { categories } = this.state;
        return categories.filter(category => category.advanced);
    }

    private getAllCategoriesList(): ToolboxCategory[] {
        const { categories, hasSearch, expandedItem } = this.state;
        const categoriesList: ToolboxCategory[] = [];
        if (hasSearch) categoriesList.push(ToolboxSearch.getSearchTreeRow());
        categories.forEach(category => {
            categoriesList.push(category);
            if (category.subcategories && expandedItem == category.nameid) category.subcategories.forEach(subcategory => {
                categoriesList.push(subcategory);
            })
        })
        return categoriesList;
    }

    shouldComponentUpdate(nextProps: ToolboxProps, nextState: ToolboxState) {
        if (this.state != nextState) return true;
        return false;
    }

    renderCore() {
        const { editorname, parent } = this.props;
        const { showAdvanced, visible, loading, selectedItem, expandedItem, hasSearch, showSearchBox } = this.state;
        if (!visible) return <div style={{ display: 'none' }} />

        if (loading) return <div>
            <div className="blocklyTreeRoot">
                <div className="blocklyTreeRow" style={{ opacity: 0 }} />
            </div>
            <div className="ui active dimmer">
                <div className="ui loader indeterminate" />
            </div>
        </div>;

        const hasAdvanced = this.hasAdvancedCategories();

        let nonAdvancedCategories = this.getNonAdvancedCategories();
        const advancedCategories = hasAdvanced ? this.getAdvancedCategories() : [];

        this.items = this.getAllCategoriesList();

        const searchTreeRow = ToolboxSearch.getSearchTreeRow();

        let index = 0;
        return <div ref={e => this.rootElement = e} id={`${name}EditorToolbox`}>
            {showSearchBox ? <ToolboxSearch ref="searchbox" parent={parent} toolbox={this} editorname={editorname} /> : undefined}
            <div className="blocklyTreeRoot">
                <div role="tree">
                    {hasSearch ? <CategoryItem key={"search"} toolbox={this} index={index++} selected={selectedItem == "search"} treeRow={searchTreeRow} onCategoryClick={this.setSelection.bind(this)} /> : undefined}
                    {nonAdvancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection.bind(this)}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} index={expandedItem == treeRow.nameid ? index++ : -1} toolbox={this} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection.bind(this)} />
                            )) : undefined}
                        </CategoryItem>
                    ))}
                    {hasAdvanced ? <TreeSeparator key="advancedseparator" /> : undefined}
                    {hasAdvanced ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: pxt.toolbox.advancedTitle(), color: pxt.toolbox.getNamespaceColor('advanced'), icon: pxt.toolbox.getNamespaceIcon(showAdvanced ? 'advancedexpanded' : 'advancedcollapsed') }} onCategoryClick={this.advancedClicked.bind(this)} /> : undefined}
                    {showAdvanced ? advancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection.bind(this)}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={expandedItem == treeRow.nameid ? index++ : -1} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection.bind(this)} />
                            )) : undefined}
                        </CategoryItem>
                    )) : undefined}
                </div>
            </div>
        </div>
    }
}

export interface CategoryItemProps extends TreeRowProps {
    toolbox: Toolbox;
    childrenVisible?: boolean;
    onCategoryClick?: (treeRow: ToolboxCategory, index: number) => void;
    index?: number;
}

export interface CategoryItemState {
    selected?: boolean;
}

export class CategoryItem extends data.Component<CategoryItemProps, CategoryItemState> {
    private treeRowElement: TreeRow;

    constructor(props: CategoryItemProps) {
        super(props);
        this.state = {
            selected: props.selected
        }
    }

    getTreeRow() {
        return this.treeRowElement;
    }

    componentWillReceiveProps(nextProps: CategoryItemProps) {
        const newState: CategoryItemState = {};
        if (nextProps.selected != undefined) {
            newState.selected = nextProps.selected;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    componentDidUpdate(prevProps: CategoryItemProps, prevState: CategoryItemState) {
        const { toolbox } = this.props;
        if (this.state.selected) {
            this.props.toolbox.setSelectedItem(this);
            if (!toolbox.state.focusSearch) this.focusElement();
        }
    }

    focusElement() {
        this.treeRowElement.focus();
    }

    handleClick = () => {
        const { treeRow, onCategoryClick, index } = this.props;
        if (onCategoryClick) onCategoryClick(treeRow, index);
    }

    renderCore() {
        const { toolbox, childrenVisible } = this.props;
        const { selected } = this.state;

        const editorname = toolbox.props.editorname;
        const previousItem = () => {
            pxt.tickEvent(`${editorname}.toolbox.keyboard.prev"`, undefined, { interactiveConsent: true });
            toolbox.setPreviousItem();
        }
        const nextItem = () => {
            pxt.tickEvent(`${editorname}.toolbox.keyboard.next"`, undefined, { interactiveConsent: true });
            toolbox.setNextItem();
        }
        const isRtl = Util.isUserLanguageRtl();
        const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
            const charCode = core.keyCodeFromEvent(e);
            if (charCode == 40) { //  DOWN
                nextItem();
            } else if (charCode == 38) { // UP
                previousItem();
            } else if ((charCode == 39 && !isRtl) || (charCode == 37 && isRtl)) { // (LEFT & LTR) || (RIGHT & RTL)
                // Focus inside flyout
                toolbox.moveFocusToFlyout();
            } else if (charCode == 27) { // ESCAPE
                // Close the flyout
                toolbox.closeFlyout();
            } else if (charCode == core.ENTER_KEY || charCode == core.SPACE_KEY) {
                sui.fireClickOnEnter.call(this, e);
            } else if (charCode == core.TAB_KEY
                || charCode == 37 /* Left arrow key */
                || charCode == 39 /* Left arrow key */
                || charCode == 16 /* Shift Key */) {
                // Escape tab and shift key
            } else {
                toolbox.setSearch();
            }
        }

        return <TreeItem>
            <TreeRow ref={e => this.treeRowElement = e} {...this.props} selected={selected} onClick={this.handleClick} onKeyDown={onKeyDown.bind(this)} />
            <TreeGroup visible={childrenVisible}>
                {this.props.children}
            </TreeGroup>
        </TreeItem>
    }
}

export interface ToolboxCategory {
    nameid: string;
    subns?: string;

    name?: string;
    color?: string;
    icon?: string;

    groups?: string[];
    groupIcons?: string[];
    labelLineWidth?: string;

    blocks?: BlockDefinition[];
    subcategories?: ToolboxCategory[];

    customClick?: (theEditor: editor.ToolboxEditor) => boolean;
    advanced?: boolean; /*@internal*/
}

export interface TreeRowProps {
    treeRow: ToolboxCategory;
    onClick?: () => void;
    onKeyDown?: () => void;
    selected?: boolean;
}

export class TreeRow extends data.Component<TreeRowProps, {}> {

    private treeRow: HTMLElement;

    focus() {
        if (this.treeRow) this.treeRow.focus();
    }

    getProperties() {
        const { treeRow } = this.props;
        return treeRow;
    }

    renderCore() {
        const { selected, onClick, onKeyDown } = this.props;
        const { nameid, subns, name, icon, color } = this.props.treeRow;
        const appTheme = pxt.appTarget.appTheme;
        let metaColor = pxt.toolbox.convertColor(color);

        const invertedMultipler = appTheme.blocklyOptions
            && appTheme.blocklyOptions.toolboxOptions
            && appTheme.blocklyOptions.toolboxOptions.invertedMultiplier || 0.3;

        let onmouseenter = () => {
            if (appTheme.invertedToolbox) {
                this.treeRow.style.backgroundColor = pxt.toolbox.fadeColor(metaColor || '#ddd', invertedMultipler, false);
            }
        }
        let onmouseleave = () => {
            if (appTheme.invertedToolbox) {
                this.treeRow.style.backgroundColor = (metaColor || '#ddd');
            }
        }
        let treeRowStyle: React.CSSProperties = {
            paddingLeft: '0px'
        }
        let treeRowClass = 'blocklyTreeRow';
        if (appTheme.coloredToolbox) {
            // Colored toolbox
            treeRowStyle.color = `${metaColor}`;
            treeRowStyle.borderLeft = `8px solid ${metaColor}`;
        } else if (appTheme.invertedToolbox) {
            // Inverted toolbox
            treeRowStyle.backgroundColor = (metaColor || '#ddd');
            treeRowStyle.color = '#fff';
        } else {
            // Standard toolbox
            treeRowStyle.borderLeft = `8px solid ${metaColor}`;
        }

        // Selected
        if (selected) {
            treeRowClass += ' blocklyTreeSelected';
            if (appTheme.invertedToolbox) {
                treeRowStyle.backgroundColor = `${pxt.toolbox.fadeColor(color, invertedMultipler, false)}`;
            } else {
                treeRowStyle.backgroundColor = (metaColor || '#ddd');
            }
            treeRowStyle.color = '#fff';
        }

        // Icon
        const iconClass = `blocklyTreeIcon${subns ? 'more' : icon ? (nameid || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');

        return <div ref={e => this.treeRow = e} className={treeRowClass}
            style={treeRowStyle} tabIndex={0}
            onMouseEnter={onmouseenter} onMouseLeave={onmouseleave}
            onClick={onClick} onKeyDown={onKeyDown ? onKeyDown : sui.fireClickOnEnter}>
            <span className="blocklyTreeIcon" role="presentation"></span>
            <span style={{ display: 'inline-block' }} className={`blocklyTreeIcon ${iconClass}`} role="presentation">{icon}</span>
            <span className="blocklyTreeLabel">{name ? name : `${Util.capitalize(subns || nameid)}`}</span>
        </div>
    }
}

export class TreeSeparator extends data.Component<{}, {}> {
    renderCore() {
        return <TreeItem>
            <div className="blocklyTreeSeparator">
                <span style={{ display: 'inline-block' }} role="presentation"></span>
            </div>
        </TreeItem>
    }
}

export interface TreeItemProps {
    selected?: boolean;
    children?: any;
}

export class TreeItem extends data.Component<TreeItemProps, {}> {
    renderCore() {
        const { selected } = this.props;
        return <div role="treeitem" aria-selected={selected}>
            {this.props.children}
        </div>
    }
}

export interface TreeGroupProps {
    visible?: boolean;
    children?: any;
}

export class TreeGroup extends data.Component<TreeGroupProps, {}> {
    renderCore() {
        const { visible } = this.props;
        return <div role="group" style={{ backgroundPosition: '0px 0px', 'display': visible ? '' : 'none' }}>
            {this.props.children}
        </div>
    }
}


export interface ToolboxSearchProps {
    parent: editor.ToolboxEditor;
    editorname: string;
    toolbox: Toolbox;
}

export interface ToolboxSearchState {
    searchAccessibilityLabel?: string;
}

export class ToolboxSearch extends data.Component<ToolboxSearchProps, ToolboxSearchState> {

    constructor(props: ToolboxSearchProps) {
        super(props);
        this.state = {
        }
    }

    static getSearchTreeRow(): ToolboxCategory {
        return {
            nameid: 'search',
            name: lf("{id:category}Search"),
            color: pxt.toolbox.getNamespaceColor('search'),
            icon: pxt.toolbox.getNamespaceIcon('search')
        }
    }

    private search = Util.debounce(() => {
        this.searchImmediate();
    }, 300, false);

    handleChange() {
        this.search();
    }

    handleKeyDown(e: KeyboardEvent) {
        const { toolbox } = this.props;
        let charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode === 40 /* Down Key */) {
            // Select first item in the toolbox
            toolbox.selectFirstItem();
        }
    }

    focus() {
        (this.refs.searchInput as HTMLInputElement).focus();
    }

    searchImmediate() {
        const { parent, toolbox, editorname } = this.props;
        const searchTerm = (this.refs.searchInput as HTMLInputElement).value;

        let searchAccessibilityLabel = '';
        let hasSearch = false;

        pxt.tickEvent(`${editorname}.search`, undefined, { interactiveConsent: true });

        // Execute search
        parent.searchAsync(searchTerm)
            .done((blocks) => {
                if (blocks.length == 0) {
                    searchAccessibilityLabel = lf("No search results...");
                } else {
                    searchAccessibilityLabel = lf("{0} result matching '{1}'", blocks.length, searchTerm.toLowerCase());
                }
                hasSearch = searchTerm != '';

                const newState: ToolboxState = {};
                newState.hasSearch = hasSearch;
                newState.searchBlocks = blocks;
                newState.focusSearch = true;
                if (hasSearch) newState.selectedItem = 'search';
                toolbox.setState(newState);

                this.setState({ searchAccessibilityLabel: searchAccessibilityLabel });
            });
    }

    renderCore() {
        const { searchAccessibilityLabel } = this.state;
        return <div id="blocklySearchArea">
            <div id="blocklySearchInput" className="ui fluid icon input" role="search">
                <input ref="searchInput" type="text" placeholder="Search..." onFocus={this.searchImmediate.bind(this)} onKeyDown={this.handleKeyDown.bind(this)} onChange={this.handleChange.bind(this)}
                    id="blocklySearchInputField" className="blocklySearchInputField" />
                <i className="search icon" role="presentation" aria-hidden="true"></i>
                <div className="accessible-hidden" id="blocklySearchLabel" aria-live="polite"> {searchAccessibilityLabel} </div>
            </div>
        </div>
    }
}

export class ToolboxTrashIcon extends data.Component<{}, {}> {

    renderCore() {
        return <div id="blocklyTrashIcon" style={{ opacity: 0, display: 'none' }}>
            <i className="trash icon" aria-hidden="true"></i>
        </div>
    }
}