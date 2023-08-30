/// <reference path="../../localtypings/pxtarget.d.ts" />

import * as React from "react"
import * as data from "./data"
import * as editor from "./toolboxeditor"
import * as sui from "./sui"
import * as core from "./core"
import * as coretsx from "./coretsx";
import * as pkg from "./package";

import Util = pxt.Util;
import { fireClickOnEnter } from "./util"
import { DeleteConfirmationModal } from "../../react-common/components/extensions/DeleteConfirmationModal"

export const enum CategoryNameID {
    Loops = "loops",
    Logic = "logic",
    Variables = "variables",
    Maths = "Math",
    Functions = "functions",
    Arrays = "arrays",
    Text = "text",
    Extensions = "addpackage"
}

// this is a supertype of pxtc.SymbolInfo (see partitionBlocks)
export interface BlockDefinition {
    qName?: string;
    name: string;
    pyQName?: string;
    pyName?: string;
    namespace?: string;
    type?: string;
    snippet?: string;
    snippetName?: string;
    pySnippet?: string;
    pySnippetName?: string;
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
        topblockWeight?: number;
        help?: string;
        _def?: pxtc.ParsedBlockDef;
    };
    retType?: string;
    blockXml?: string;
    builtinBlock?: boolean;
    builtinField?: [string, string];
    parameters?: pxtc.ParameterDesc[];
}

export interface GroupDefinition {
    name: string;
    icon?: string;
    hasHelp?: boolean;
    blocks: BlockDefinition[];
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
}

export interface BuiltinCategoryDefinition {
    name: string;
    nameid: string;
    blocks: (BlockDefinition | ButtonDefinition)[];
    groups?: string[];
    attributes: pxtc.CommentAttrs;
    removed?: boolean;
    custom?: boolean; // Only add blocks defined in .blocks and don't query nsMap for more
    customClick?: (theEditor: editor.ToolboxEditor) => boolean; // custom handler
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

    hasError?: boolean;

    shouldAnimate?: boolean;

    tryToDeleteNamespace?: string;
}

const MONACO_EDITOR_NAME: string = "monaco";

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
            showAdvanced: false,
            shouldAnimate: !pxt.shell.getToolboxAnimation()
        }

        this.setSelection = this.setSelection.bind(this);
        this.advancedClicked = this.advancedClicked.bind(this);
        this.recoverToolbox = this.recoverToolbox.bind(this);
        this.handleRemoveExtension = this.handleRemoveExtension.bind(this);
        this.deleteExtension = this.deleteExtension.bind(this);
        this.cancelDeleteExtension= this.cancelDeleteExtension.bind(this);
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
            // Check if the previous item has a subcategory
            let previousItem = this.items[newIndex];
            this.setSelection(previousItem, newIndex);
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
        this.selectedTreeRow = undefined;
    }

    clearSelection() {
        this.setState({ selectedItem: undefined, focusSearch: false });
    }

    clearExpandedItem() {
        this.setState({ expandedItem: undefined });
    }

    clearSearch() {
        this.setState({ hasSearch: false, searchBlocks: undefined, focusSearch: false });
    }


    async handleRemoveExtension(ns: string) {
        this.setState({
            tryToDeleteNamespace: ns
        })
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
                this.selectedTreeRow = treeRow;
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

    UNSAFE_componentWillReceiveProps(props: ToolboxProps) {
        // if leaving monaco, mark toolbox animation as shown. also
        // handles full screen sim, where we hide the toolbox via css
        // without re-rendering, which will trigger the animation again
        if ((this.props.editorname == MONACO_EDITOR_NAME && props.editorname != MONACO_EDITOR_NAME)
            || (props.editorname == MONACO_EDITOR_NAME && props.parent.parent.state.fullscreen)
            && this.state.shouldAnimate) {
            pxt.shell.setToolboxAnimation();
            this.setState({ shouldAnimate: false });
        }
    }

    componentDidUpdate(prevProps: ToolboxProps, prevState: ToolboxState) {
        if (prevState.visible != this.state.visible
            || prevState.loading != this.state.loading
            || prevState.showAdvanced != this.state.showAdvanced
            || this.state.expandedItem != prevState.expandedItem) {
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

    componentDidCatch(error: any, info: any) {
        // Log what happened
        const { editorname } = this.props;
        pxt.tickEvent(`${editorname}.toolbox.crashed`, { error: error });

        // Update error state
        this.setState({ hasError: true });
    }

    componentWillUnmount() {
        if (this.props.editorname == MONACO_EDITOR_NAME) {
            pxt.shell.setToolboxAnimation();
        }
    }

    recoverToolbox() {
        // Recover from above error state
        this.setState({ hasError: false });
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
        if (!this.state.selectedItem || !this.selectedTreeRow) return;
        if (this.selectedTreeRow.customClick) {
            this.selectedTreeRow.customClick(parent);
        } else {
            this.showFlyout(this.selectedTreeRow);
        }
    }

    refreshSearchItem() {
        const searchTreeRow = ToolboxSearch.getSearchTreeRow();
        this.showFlyout(searchTreeRow);
    }

    private selectedTreeRow: ToolboxCategory;
    private showFlyout(treeRow: ToolboxCategory) {
        const { parent } = this.props;
        // const t0 = performance.now();
        parent.showFlyout(treeRow);
        // const t1 = performance.now();
        // pxt.debug("perf: call to showFlyout took " + (t1 - t0) + " milliseconds.");
    }

    private async deleteExtension(ns: string) {
        this.setState({
            tryToDeleteNamespace: undefined
        })
        // TODO: Not implemented yet.
        // Remove the top level extension, only if there are no blocks in the workspace
        // Associated with that extension.
        await this.props.parent.parent.reloadHeaderAsync()
    }

    private cancelDeleteExtension() {
        this.setState({
            tryToDeleteNamespace: undefined
        })
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

    private getAllCategoriesList(visibleOnly?: boolean): ToolboxCategory[] {
        const { categories, hasSearch, expandedItem } = this.state;
        const categoriesList: ToolboxCategory[] = [];
        if (hasSearch) categoriesList.push(ToolboxSearch.getSearchTreeRow());
        categories.forEach(category => {
            categoriesList.push(category);
            if (category.subcategories &&
                (!visibleOnly || visibleOnly && category.nameid == expandedItem)) {
                category.subcategories.forEach(subcategory => {
                    categoriesList.push(subcategory);
                })
            }
        })
        return categoriesList;
    }

    shouldComponentUpdate(nextProps: ToolboxProps, nextState: ToolboxState) {
        if (this.state != nextState) return true;
        return false;
    }

    handleRootElementRef = (c: HTMLDivElement) => {
        this.rootElement = c;
    }

    isRtl() {
        const { editorname } = this.props;
        return editorname == 'monaco' ? false : Util.isUserLanguageRtl();
    }

    renderCore() {
        const { editorname, parent } = this.props;
        const { showAdvanced, visible, loading, selectedItem, expandedItem, hasSearch, showSearchBox, hasError, tryToDeleteNamespace } = this.state;
        if (!visible) return <div style={{ display: 'none' }} />

        const theme = pxt.appTarget.appTheme;
        const tutorialOptions = parent.parent.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial
        const hasTopBlocks = !!theme.topBlocks && !inTutorial;

        const showToolboxLabel = inTutorial;

        if (loading || hasError) return <div>
            <div className="blocklyTreeRoot">
                <div className="blocklyTreeRow" style={{ opacity: 0 }} />
            </div>
            {loading ? <div className="ui active dimmer">
                <div className="ui loader indeterminate" />
            </div> : undefined}
            {hasError ? <div className="ui">
                {lf("Toolbox crashed..")}
                <sui.Button icon='refresh' onClick={this.recoverToolbox}
                    text={lf("Reload")} className='fluid' />
            </div> : undefined}
        </div>;

        const hasAdvanced = this.hasAdvancedCategories();

        let nonAdvancedCategories = this.getNonAdvancedCategories();
        const advancedCategories = hasAdvanced ? this.getAdvancedCategories() : [];

        this.items = this.getAllCategoriesList();

        const searchTreeRow = ToolboxSearch.getSearchTreeRow();
        const topBlocksTreeRow = {
            nameid: 'topblocks',
            name: lf("{id:category}Basic"),
            color: pxt.toolbox.getNamespaceColor('topblocks'),
            icon: pxt.toolbox.getNamespaceIcon('topblocks')
        };

        const appTheme = pxt.appTarget.appTheme;
        const classes = sui.cx([
            'pxtToolbox',
            appTheme.invertedToolbox ? 'invertedToolbox' : '',
            appTheme.coloredToolbox ? 'coloredToolbox' : ''
        ])

        let index = 0;
        let topRowIndex = 0; // index of top-level rows for animation
        const advancedButtonState = showAdvanced ? "advancedexpanded" : "advancedcollapsed";
        return <div ref={this.handleRootElementRef} className={classes} id={`${editorname}EditorToolbox`}>
            <ToolboxStyle categories={this.items} />
            {showToolboxLabel && <div className="toolbox-title">{lf("Toolbox")}</div>}
            {showSearchBox ? <ToolboxSearch ref="searchbox" parent={parent} toolbox={this} editorname={editorname} /> : undefined}
            <div className="blocklyTreeRoot">
                <div role="tree">
                    {tryToDeleteNamespace ? <DeleteConfirmationModal ns={tryToDeleteNamespace} onCancelClick={this.cancelDeleteExtension} onDeleteClick={this.deleteExtension}/>:undefined}
                    {hasSearch ? <CategoryItem key={"search"} toolbox={this} index={index++} selected={selectedItem == "search"} treeRow={searchTreeRow} onCategoryClick={this.setSelection} /> : undefined}
                    {hasTopBlocks ? <CategoryItem key={"topblocks"} toolbox={this} selected={selectedItem == "topblocks"} treeRow={topBlocksTreeRow} onCategoryClick={this.setSelection} /> : undefined}
                    {nonAdvancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection} topRowIndex={topRowIndex++} shouldAnimate={this.state.shouldAnimate} hasDeleteButton={treeRow.allowDelete} onDeleteClick={this.handleRemoveExtension}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid + subTreeRow.subns} index={index++} toolbox={this} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
                            )) : undefined}
                        </CategoryItem>
                    ))}
                    {hasAdvanced ? <TreeSeparator key="advancedseparator" /> : undefined}
                    {hasAdvanced ? <CategoryItem toolbox={this} treeRow={{ nameid: "", name: pxt.toolbox.advancedTitle(), color: pxt.toolbox.getNamespaceColor('advanced'), icon: pxt.toolbox.getNamespaceIcon(advancedButtonState), advancedButtonState: advancedButtonState }} onCategoryClick={this.advancedClicked} topRowIndex={topRowIndex++} /> : undefined}
                    {showAdvanced ? advancedCategories.map((treeRow) => (
                        <CategoryItem key={treeRow.nameid} toolbox={this} index={index++} selected={selectedItem == treeRow.nameid} childrenVisible={expandedItem == treeRow.nameid} treeRow={treeRow} onCategoryClick={this.setSelection}>
                            {treeRow.subcategories ? treeRow.subcategories.map((subTreeRow) => (
                                <CategoryItem key={subTreeRow.nameid} toolbox={this} index={index++} selected={selectedItem == (subTreeRow.nameid + subTreeRow.subns)} treeRow={subTreeRow} onCategoryClick={this.setSelection} />
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
    topRowIndex?: number;
    hasDeleteButton?: boolean;
    onDeleteClick?: (ns: string) => void;
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

        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    getTreeRow() {
        return this.treeRowElement;
    }

    UNSAFE_componentWillReceiveProps(nextProps: CategoryItemProps) {
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
            if (!toolbox.state.focusSearch && !coretsx.dialogIsShowing()) this.focusElement();
        }
    }

    focusElement() {
        this.treeRowElement.focus();
    }

    handleClick(e: React.MouseEvent<any>) {
        const { treeRow, onCategoryClick, index } = this.props;
        if (onCategoryClick) onCategoryClick(treeRow, index);

        e.preventDefault();
        e.stopPropagation();
    }

    handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
        const { toolbox } = this.props;
        const isRtl = Util.isUserLanguageRtl();

        const mainWorkspace = Blockly.getMainWorkspace() as any;
        const accessibleBlocksEnabled = mainWorkspace.keyboardAccessibilityMode;
        const accessibleBlocksState = accessibleBlocksEnabled
            && (toolbox.props.parent as any).navigationController?.navigation?.getState(mainWorkspace);
        const keyMap: { [key: string]: number } = {
            "DOWN": accessibleBlocksEnabled ? 83 : 40, // 'S' || down arrow
            "UP": accessibleBlocksEnabled ? 87 : 38, // 'W' || up arrow
            "LEFT": accessibleBlocksEnabled ? 65 : 37, // 'A' || left arrow
            "RIGHT": accessibleBlocksEnabled ? 68 : 39 // 'D' || right arrow
        }

        const charCode = core.keyCodeFromEvent(e);
        if (!accessibleBlocksEnabled || accessibleBlocksState == "toolbox") {
            if (charCode == keyMap["DOWN"]) {
                this.nextItem();
            } else if (charCode == keyMap["UP"]) {
                this.previousItem();
            } else if ((charCode == keyMap["RIGHT"] && !isRtl)
                || (charCode == keyMap["LEFT"] && isRtl)) {
                // Focus inside flyout
                toolbox.moveFocusToFlyout();
            } else if (charCode == 27) { // ESCAPE
                // Close the flyout
                toolbox.closeFlyout();
            } else if (charCode == core.ENTER_KEY || charCode == core.SPACE_KEY) {
                fireClickOnEnter.call(this, e);
            } else if (charCode == core.TAB_KEY
                || charCode == 37 /* Left arrow key */
                || charCode == 39 /* Left arrow key */
                || charCode == 17 /* Ctrl Key */
                || charCode == 16 /* Shift Key */
                || charCode == 91 /* Cmd Key */) {
                // Escape tab and shift key
            } else if (!accessibleBlocksEnabled) {
                toolbox.setSearch();
            }
        } else if (accessibleBlocksEnabled && accessibleBlocksState == "flyout"
            && ((charCode == keyMap["LEFT"] && !isRtl)
            || (charCode == keyMap["RIGHT"] && isRtl))) {
            this.focusElement();
            e.stopPropagation();
        }
    }

    previousItem() {
        const { toolbox, childrenVisible } = this.props;
        const editorname = toolbox.props.editorname;

        pxt.tickEvent(`${editorname}.toolbox.keyboard.prev"`, undefined, { interactiveConsent: true });
        toolbox.setPreviousItem();
    }

    nextItem() {
        const { toolbox, childrenVisible } = this.props;
        const editorname = toolbox.props.editorname;

        pxt.tickEvent(`${editorname}.toolbox.keyboard.next"`, undefined, { interactiveConsent: true });
        toolbox.setNextItem();
    }

    handleTreeRowRef = (c: TreeRow) => {
        this.treeRowElement = c;
    }

    renderCore() {
        const { toolbox, childrenVisible, hasDeleteButton } = this.props;
        const { selected } = this.state;

        return <TreeItem>
            <TreeRow ref={this.handleTreeRowRef} isRtl={toolbox.isRtl()} {...this.props} selected={selected}
                onClick={this.handleClick} onKeyDown={this.handleKeyDown} hasDeleteButton={hasDeleteButton}/>
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
    groupHelp?: string[];
    labelLineWidth?: string;

    blocks?: BlockDefinition[];
    subcategories?: ToolboxCategory[];

    customClick?: (theEditor: editor.ToolboxEditor) => boolean;
    advanced?: boolean; /*@internal*/
    allowDelete?: boolean;
    // for advanced button, the current state of the button
    advancedButtonState?: "advancedexpanded" | "advancedcollapsed";
}

export interface TreeRowProps {
    treeRow: ToolboxCategory;
    onClick?: (e: React.MouseEvent<any>) => void;
    onKeyDown?: (e: React.KeyboardEvent<any>) => void;
    selected?: boolean;
    isRtl?: boolean;
    topRowIndex?: number;
    shouldAnimate?: boolean;
    hasDeleteButton?: boolean;
    onDeleteClick?: (ns: string) => void;
}

export class TreeRow extends data.Component<TreeRowProps, {}> {

    private treeRow: HTMLElement;
    private baseAnimationDelay: number = 1;
    private animationDelay: number = 0.15;
    private brandIcons = {
        '\uf287': 'usb', '\uf368': 'accessible-icon', '\uf170': 'adn', '\uf1a7': 'pied-piper-pp', '\uf1b6': 'steam', '\uf294': 'bluetooth-b',
        '\uf1d0': 'rebel', '\uf136': 'maxcdn', '\uf1aa': 'joomla', '\uf213': 'sellsy', '\uf20e': 'connectdevelop', '\uf113': 'github-alt'
    };

    constructor(props: TreeRowProps) {
        super(props);
        this.state = {
        }

        this.handleDeleteClick = this.handleDeleteClick.bind(this);
    }

    focus() {
        if (this.treeRow) this.treeRow.focus();
    }

    getProperties() {
        const { treeRow } = this.props;
        return treeRow;
    }

    getMetaColor() {
        const { color } = this.props.treeRow;
        return pxt.toolbox.convertColor(color) || pxt.toolbox.getNamespaceColor('default');
    }

    handleTreeRowRef = (c: HTMLDivElement) => {
        this.treeRow = c;
    }

    handleDeleteClick (e: React.MouseEvent) {
        e.stopPropagation();
        this.props.onDeleteClick(this.props.treeRow.nameid)
    }

    renderCore() {
        const { selected, onClick, onKeyDown, isRtl, topRowIndex, hasDeleteButton, onDeleteClick } = this.props;
        const { nameid, advancedButtonState, subns, name, icon } = this.props.treeRow;
        const appTheme = pxt.appTarget.appTheme;
        const metaColor = this.getMetaColor();

        const invertedMultipler = appTheme.blocklyOptions
            && appTheme.blocklyOptions.toolboxOptions
            && appTheme.blocklyOptions.toolboxOptions.invertedMultiplier || 0.3;

        let treeRowStyle: React.CSSProperties = {
            paddingLeft: '0px',
            "--block-meta-color": metaColor,
            "--block-faded-color": pxt.toolbox.fadeColor(metaColor || '#ddd', invertedMultipler, false)
        } as React.CSSProperties;

        let treeRowClass = `blocklyTreeRow${selected ? ' blocklyTreeSelected' : '' }`;

        if (topRowIndex && this.props.shouldAnimate) {
            treeRowStyle.animationDelay = `${(topRowIndex * this.animationDelay) + this.baseAnimationDelay}s`;
            treeRowClass += ' blocklyTreeAnimate';
        }

        // Icon
        let iconClass = `blocklyTreeIcon${subns ? 'more' : icon ? (nameid || icon).toLowerCase() : 'Default'}`.replace(/\s/g, '');
        let iconContent = subns ? pxt.toolbox.getNamespaceIcon('more') : icon || pxt.toolbox.getNamespaceIcon('default');
        const isImageIcon = iconContent.length > 1;  // It's probably an image icon, and not an icon code
        let iconImageStyle: React.CSSProperties = {
            "--image-icon-url": isImageIcon ? `url("${Util.pathJoin(pxt.webConfig.commitCdnUrl, encodeURI(icon))}")!important`: undefined,
            display: "inline-block"
        } as React.CSSProperties;

        if (isImageIcon) {
            iconClass += ' image-icon';
            iconContent = undefined;
        }
        const rowTitle = name ? name : Util.capitalize(subns || nameid);
        const dataNs = advancedButtonState || nameid;

        const extraIconClass = !subns && Object.keys(this.brandIcons).includes(icon) ? 'brandIcon' : ''
        return <div role="button" ref={this.handleTreeRowRef} className={treeRowClass}
            style={treeRowStyle} tabIndex={0}
            data-ns={dataNs}
            aria-label={lf("Toggle category {0}", rowTitle)} aria-expanded={selected}
            onClick={onClick} onContextMenu={onClick} onKeyDown={onKeyDown ? onKeyDown : fireClickOnEnter}>
            <span className="blocklyTreeIcon" role="presentation"></span>
            <span style={iconImageStyle} className={`blocklyTreeIcon ${iconClass} ${extraIconClass}`} role="presentation">{iconContent}</span>
            <span className="blocklyTreeLabel">{rowTitle}</span>
            {hasDeleteButton ? <i className="blocklyTreeButton icon times circle" onClick={this.handleDeleteClick}/>: undefined}
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
        if (!this.props.children) return <div />;

        return <div role="tree" style={{ backgroundPosition: '0px 0px', 'display': visible ? '' : 'none' }}>
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

        this.searchImmediate = this.searchImmediate.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleChange = this.handleChange.bind(this);
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

    handleKeyDown(e: React.KeyboardEvent<any>) {
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
            .then((blocks) => {
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
                <input ref="searchInput" type="text" placeholder={lf("Search...")}
                    onFocus={this.searchImmediate} onKeyDown={this.handleKeyDown} onChange={this.handleChange}
                    id="blocklySearchInputField" className="blocklySearchInputField"
                    aria-label={lf("Search")}
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                <i className="search icon" role="presentation" aria-hidden="true"></i>
                <div className="accessible-hidden" id="blocklySearchLabel" aria-live="polite"> {searchAccessibilityLabel} </div>
            </div>
        </div>
    }
}

interface ToolboxTrashIconProps {
    flyoutOnly?: boolean;
}

export class ToolboxTrashIcon extends data.Component<ToolboxTrashIconProps, {}> {
    constructor(props: ToolboxTrashIconProps) {
        super(props);
    }

    getStyle() {
        let style: any = { opacity: 0, display: 'none' };
        if (this.props.flyoutOnly) {
            let flyout = document.querySelector('.blocklyFlyout');
            if (flyout) {
                style["left"] = (flyout.clientWidth / 2);
                style["transform"] = "translateX(-45%)";
            }
        }
        return style;
    }

    renderCore() {
        return <div id="blocklyTrashIcon" style={this.getStyle()}>
            <i className="trash icon" aria-hidden="true"></i>
        </div>
    }
}

interface ToolboxStyleProps {
    categories: ToolboxCategory[];
}

export class ToolboxStyle extends data.Component<ToolboxStyleProps, {}> {
    renderCore() {
        const { categories } = this.props;
        // Add inline CSS for each category used so that the tutorial engine is able to render blocks
        // and assosiate them with a specific category
        return <style>
            {categories.filter(c => !!c.color).map(category =>
                `span.docs.inlineblock.${category.nameid.toLowerCase()} {
                    background-color: ${category.color};
                    border-color: ${pxt.toolbox.fadeColor(category.color, 0.1, false)};
                }`
            )}
        </style>
    }
}
