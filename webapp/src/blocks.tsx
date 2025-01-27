/// <reference path="../../localtypings/navigationController.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Blockly from "blockly";
import * as pkg from "./package";
import * as core from "./core";
import * as toolboxeditor from "./toolboxeditor"
import * as compiler from "./compiler"
import * as toolbox from "./toolbox";
import * as snippets from "./blocksSnippets";
import * as workspace from "./workspace";
import * as simulator from "./simulator";
import * as dialogs from "./dialogs";
import * as blocklyFieldView from "./blocklyFieldView";
import { CreateFunctionDialog } from "./createFunction";
import { initializeSnippetExtensions } from './snippetBuilder';

import * as pxtblockly from "../../pxtblocks";
import { NavigationController, Navigation } from "@blockly/keyboard-navigation";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";


import Util = pxt.Util;
import { DebuggerToolbox } from "./debuggerToolbox";
import { ErrorList } from "./errorList";
import { resolveExtensionUrl } from "./extensionManager";
import { experiments, initEditorExtensionsAsync } from "../../pxteditor";


import IProjectView = pxt.editor.IProjectView;
import MuteState = pxt.editor.MuteState;
import SimState = pxt.editor.SimState;


import { DuplicateOnDragConnectionChecker } from "../../pxtblocks/plugins/duplicateOnDrag";
import { PathObject } from "../../pxtblocks/plugins/renderer/pathObject";
import { Measurements } from "./constants";


export class Editor extends toolboxeditor.ToolboxEditor {
    editor: Blockly.WorkspaceSvg;
    currFile: pkg.File;
    delayLoadXml: string;
    typeScriptSaveable: boolean;
    loadingXml: boolean;
    loadingXmlPromise: Promise<any>;
    compilationResult: pxtblockly.BlockCompilationResult;
    isFirstBlocklyLoad = true;
    functionsDialog: CreateFunctionDialog = null;

    showCategories: boolean = true;
    breakpointsByBlock: pxt.Map<number>; // Map block id --> breakpoint ID
    breakpointsSet: number[]; // the IDs of the breakpoints set.

    private errorChangesListeners: pxt.Map<(errors: pxtblockly.BlockDiagnostic[]) => void> = {};
    protected intersectionObserver: IntersectionObserver;

    protected debuggerToolbox: DebuggerToolbox;
    protected highlightedStatement: pxtc.LocationInfo;

    // Blockly plugins
    protected navigationController: NavigationController;
    protected workspaceSearch: WorkspaceSearch;

    public nsMap: pxt.Map<toolbox.BlockDefinition[]>;

    constructor(parent: IProjectView) {
        super(parent);

        this.listenToBlockErrorChanges = this.listenToBlockErrorChanges.bind(this)
        this.onErrorListResize = this.onErrorListResize.bind(this)
    }
    setBreakpointsMap(breakpoints: pxtc.Breakpoint[], procCallLocations: pxtc.LocationInfo[]): void {
        if (!breakpoints || !this.compilationResult) return;
        const blockToAllBreakpoints: { [index: string]: pxtc.Breakpoint[] } = {};

        for (const breakpoint of breakpoints) {
            const blockId = pxtblockly.findBlockIdByLine(this.compilationResult.sourceMap, { start: breakpoint.line, length: breakpoint.endLine - breakpoint.line });
            if (!blockToAllBreakpoints[blockId]) blockToAllBreakpoints[blockId] = [];
            blockToAllBreakpoints[blockId].push(breakpoint);
        }

        this.breakpointsByBlock = {};
        for (const blockId of Object.keys(blockToAllBreakpoints)) {
            // Default to the last breakpoint for the block
            let breakpoint = blockToAllBreakpoints[blockId][blockToAllBreakpoints[blockId].length - 1];

            const block = this.editor.getBlockById(blockId);
            if (!block) {
                this.breakpointsByBlock[blockId] = breakpoint.id;
                continue;
            }

            switch (block.type) {
                case "pxt_controls_for":
                case "controls_for":
                case "controls_simple_for":
                    // Get the conditional breakpoint
                    breakpoint = blockToAllBreakpoints[blockId][2];
                    break;
            }

            this.breakpointsByBlock[blockId] = breakpoint.id;
        }
    }

    setBreakpointsFromBlocks(): void {
        this.breakpointsSet = this.getBreakpoints();
        simulator.driver.setBreakpoints(this.breakpointsSet);
    }

    getBreakpoints() {
        const breakpoints: number[] = []
        const map = this.breakpointsByBlock;
        if (map && this.editor) {
            this.editor.getAllBlocks(false).forEach(block => {
                if (map[block.id] && isBreakpointSet(block)) {
                    breakpoints.push(this.breakpointsByBlock[block.id]);
                }
            });
        }
        return breakpoints;
    }

    addBreakpointFromEvent(blockId: string) {
        this.breakpointsSet.push(this.breakpointsByBlock[blockId]);
        simulator.driver.setBreakpoints(this.breakpointsSet);
    }

    removeBreakpointFromEvent(blockId: string) {
        let breakpointId = this.breakpointsByBlock[blockId];
        this.breakpointsSet.filter(breakpoint => breakpoint != breakpointId);
        simulator.driver.setBreakpoints(this.breakpointsSet);
    }

    clearBreakpoints(): void {
        simulator.driver.setBreakpoints([]);
    }

    handleKeyDown = (e: any) => {
        if (this.parent.state?.accessibleBlocks) {
            let charCode = (typeof e.which == "number") ? e.which : e.keyCode
            if (charCode === 84 /* T Key */) {
                this.focusToolbox();
                e.stopPropagation();
            }
        }
    }

    setVisible(v: boolean) {
        super.setVisible(v);
        this.isVisible = v;
        let classes = '#blocksEditor .blocklyToolboxDiv, #blocksEditor .blocklyWidgetDiv, #blocksEditor .blocklyToolboxDiv';
        if (this.isVisible) {
            pxt.Util.toArray(document.querySelectorAll(classes)).forEach((el: HTMLElement) => el.style.display = '');
            // Fire a resize event since the toolbox may have changed width and height.
            this.parent.fireResize();
        }
        else {
            pxt.Util.toArray(document.querySelectorAll(classes)).forEach((el: HTMLElement) => el.style.display = 'none');
            if (this.editor) Blockly.hideChaff();
            if (this.toolbox) this.toolbox.clearExpandedItem();
        }
    }

    saveToTypeScriptAsync(willOpenTypeScript = false): Promise<string> {
        if (!this.typeScriptSaveable) return Promise.resolve(undefined);
        this.clearHighlightedStatements();
        try {
            return pxtblockly.compileAsync(this.editor, this.blockInfo, { emitTilemapLiterals: willOpenTypeScript })
                .then((compilationResult) => {
                    this.compilationResult = compilationResult;
                    pxt.tickEvent("activity.blocks.compile");

                    let next = Promise.resolve();
                    if (willOpenTypeScript && this.parent) {
                        // If we are opening TypeScript, clean up the temporary assets
                        // We need to do these steps in this order:
                        //   1. Remove the block data elements for each field
                        //   2. Save the XML with the blocks data removed (otherwise reloading the blocks will break)
                        //   3. Dispose of the temporary assets themselves
                        clearTemporaryAssetBlockData(this.editor)
                        next = this.parent.saveCurrentSourceAsync()
                            .then(() => disposeOfTemporaryAssets(this.editor))
                    }

                    return next.then(() => this.compilationResult.source)
                });
        } catch (e) {
            pxt.reportException(e)
            core.errorNotification(lf("Sorry, we were not able to convert this program."))
            return Promise.resolve(undefined);
        }
    }

    domUpdate() {
        if (this.delayLoadXml) {
            if (this.loadingXml) return
            pxt.debug(`loading blockly`)
            pxt.perf.measureStart(Measurements.DomUpdateLoadBlockly)
            this.loadingXml = true

            const loadingDimmer = document.createElement("div");
            loadingDimmer.className = "ui active dimmer";
            const loading = document.createElement("div");
            loading.className = "ui text loader";
            loading.appendChild(document.createTextNode(lf("Loading blocks...")));
            loadingDimmer.appendChild(loading);
            let editorDiv = document.getElementById("blocksEditor");
            editorDiv.appendChild(loadingDimmer);

            compiler.clearCaches(); // ensure that we refresh the blocks list
            this.loadingXmlPromise = this.loadBlocklyAsync()
                .then(() => compiler.getBlocksAsync())
                .then(bi => {
                    this.blockInfo = bi;

                    // Initialize blocks in Blockly and update our toolbox
                    pxtblockly.initialize(this.blockInfo);
                    this.nsMap = this.partitionBlocks();
                    this.refreshToolbox();

                    pxt.debug(`loading block workspace`)
                    let xml = this.delayLoadXml;
                    this.delayLoadXml = undefined;
                    this.loadBlockly(xml);

                    this.resize();
                    Blockly.svgResize(this.editor);
                    this.isFirstBlocklyLoad = false;
                }).finally(() => {
                    try {
                        // It's possible Blockly reloads and the loading dimmer is no longer a child of the editorDiv
                        editorDiv.removeChild(loadingDimmer);
                    } catch { }
                    this.loadingXml = false;
                    this.loadingXmlPromise = null;
                    pxt.perf.measureEnd(Measurements.DomUpdateLoadBlockly)
                    // Do Not Remove: This is used by the skillmap
                    this.parent.onEditorContentLoaded();
                });
        }
    }

    onPageVisibilityChanged(isVisible: boolean) {
        if (!isVisible) return;
        if (!this.parent.state.debugging) {
            this.highlightStatement(this.highlightedStatement);
        }
    }

    isDropdownDivVisible(): boolean {
        return typeof Blockly !== "undefined"
            && Blockly.DropDownDiv
            && Blockly.DropDownDiv.isVisible();
    }

    beforeCompile() {
        // close all field editors to make sure
        // that all changes are commited
        // it is quite common for users to click download
        // while a field editor is still opened and the changes are not commited
        if (typeof Blockly === "undefined") return;

        Blockly.DropDownDiv.hide();
        Blockly.WidgetDiv.hide();
    }

    getTemporaryAssets(): pxt.Asset[] {
        if (!this.editor) return [];

        return pxtblockly.getTemporaryAssets(this.editor, pxt.AssetType.Image)
            .concat(pxtblockly.getTemporaryAssets(this.editor, pxt.AssetType.Animation))
            .concat(pxtblockly.getTemporaryAssets(this.editor, pxt.AssetType.Song));
    }

    updateTemporaryAsset(asset: pxt.Asset) {
        const block = this.editor.getBlockById(asset.meta.temporaryInfo.blockId);
        (block.getField(asset.meta.temporaryInfo.fieldName) as pxtblockly.FieldAssetEditor<any, any>).updateAsset(asset);
    }

    private saveBlockly(): string {
        // make sure we don't return an empty document before we get started
        // otherwise it may get saved and we're in trouble
        if (this.delayLoadXml) return this.delayLoadXml;
        return this.serializeBlocks();
    }

    private serializeBlocks(normalize?: boolean): string {
        // store ids when using github
        let xml = pxtblockly.saveWorkspaceXml(this.editor,
            !normalize && this.parent.state
            && this.parent.state.header
            && !!this.parent.state.header.githubId);
        // strip out id, x, y attributes
        if (normalize) xml = xml.replace(/(x|y|id)="[^"]*"/g, '')
        pxt.debug(xml)
        return xml;
    }

    private loadBlockly(s: string): boolean {
        if (this.serializeBlocks() == s) {
            this.typeScriptSaveable = true;
            pxt.debug('blocks already loaded...');
            return false;
        }

        this.typeScriptSaveable = false;
        pxtblockly.clearWithoutEvents(this.editor);
        try {
            const text = s || `<block type="${ts.pxtc.ON_START_TYPE}"></block>`;
            const xml = Blockly.utils.xml.textToDom(text);
            this.cleanXmlForWorkspace(xml);
            pxtblockly.domToWorkspaceNoEvents(xml, this.editor);

            pxtblockly.upgradeTilemapsInWorkspace(this.editor, pxt.react.getTilemapProject());

            this.initLayout(xml);
            this.editor.clearUndo();
            this.reportDeprecatedBlocks();
            this.updateGrayBlocks();

            this.typeScriptSaveable = true;
        } catch (e) {
            pxt.log(e);
            pxtblockly.clearWithoutEvents(this.editor);
            this.switchToTypeScript();
            this.changeCallback();
            return false;
        }

        this.changeCallback();

        return true;
    }

    private cleanXmlForWorkspace(dom: Element) {
        // Clear out any deletable flags. There are currently no scenarios where we rely on this flag,
        // and it can be persisted erroneously (with value "false") if the app closes unexpectedly while in debug mode.
        dom.querySelectorAll("block[deletable], shadow[deletable]").forEach(b => { b.removeAttribute("deletable") });
    }

    private initLayout(xml: Element) {
        const flyoutOnly = !this.editor.getToolbox() && this.editor.getFlyout();

        if (!flyoutOnly) {
            // If the blocks file has no location info (e.g. it's from the decompiler), format the code.
            let needsLayout = false;
            for (const child of xml.childNodes) {
                if (!pxt.BrowserUtils.isElement(child)) continue;
                if (child.localName !== "block" && child.localName !== "comment") continue;

                const x = child.getAttribute("x") ?? "10";
                const y = child.getAttribute("y") ?? "10";

                if (x === "10" && y === "10") {
                    needsLayout = true;
                    break;
                }
            }

            if (needsLayout) {
                pxtblockly.flow(this.editor, { useViewWidth: true });
                return;
            }
        }

        let minDistanceFromOrigin: number;
        let closestToOrigin: Blockly.utils.Coordinate;

        for (const comment of this.editor.getTopComments(false) as Blockly.comments.RenderedWorkspaceComment[]) {
            const coord = comment.getRelativeToSurfaceXY();

            const distanceFromOrigin = Math.sqrt(coord.x * coord.x + coord.y * coord.y);

            if (minDistanceFromOrigin === undefined || distanceFromOrigin < minDistanceFromOrigin) {
                closestToOrigin = coord;
                minDistanceFromOrigin = distanceFromOrigin;
            }
        }

        for (const block of this.editor.getTopBlocks(false)) {
            const coord = block.getRelativeToSurfaceXY();

            const distanceFromOrigin = Math.sqrt(coord.x * coord.x + coord.y * coord.y);

            if (minDistanceFromOrigin === undefined || distanceFromOrigin < minDistanceFromOrigin) {
                closestToOrigin = coord;
                minDistanceFromOrigin = distanceFromOrigin;
            }
        }

        if (closestToOrigin) {
            // Otherwise translate the blocks so that they are positioned on the top left
            for (const comment of this.editor.getTopComments(false) as Blockly.comments.RenderedWorkspaceComment[]) {
                comment.moveBy(-closestToOrigin.x, -closestToOrigin.y);
            }
            for (const block of this.editor.getTopBlocks(false)) {
                block.moveBy(-closestToOrigin.x, -closestToOrigin.y);
            }
        }
        this.editor.scrollX = 10;
        this.editor.scrollY = 10;

        // Forces scroll to take effect
        this.editor.resizeContents();
    }

    private initPrompts() {
        // Overriding blockly prompts to use semantic modals

        /**
         * Wrapper to window.alert() that app developers may override to
         * provide alternatives to the modal browser window.
         * @param {string} message The message to display to the user.
         * @param {function()=} opt_callback The callback when the alert is dismissed.
         */
        Blockly.dialog.setAlert(function (message, opt_callback) {
            return core.confirmAsync({
                hideCancel: true,
                header: lf("Alert"),
                agreeLbl: lf("Ok"),
                agreeClass: "positive",
                agreeIcon: "checkmark",
                body: message,
                size: "tiny"
            }).then(() => {
                if (opt_callback) {
                    opt_callback();
                }
            })
        })

        /**
         * Wrapper to window.confirm() that app developers may override to
         * provide alternatives to the modal browser window.
         * @param {string} message The message to display to the user.
         * @param {!function(boolean)} callback The callback for handling user response.
         */
        Blockly.dialog.setConfirm(function (message, callback) {
            return core.confirmAsync({
                header: lf("Confirm"),
                body: message,
                agreeLbl: lf("Yes"),
                agreeClass: "positive",
                agreeIcon: "checkmark",
                disagreeLbl: lf("No"),
                disagreeClass: "cancel",
                disagreeIcon: "cancel",
                size: "tiny"
            }).then(b => {
                callback(b == 1);
            })
        });

        pxtblockly.external.setPrompt(function (message, defaultValue, callback, options?: Partial<core.PromptOptions>) {
            return core.promptAsync({
                header: message,
                initialValue: defaultValue,
                agreeLbl: lf("Ok"),
                hasCloseIcon: true,
                size: "tiny",
                ...options
            }).then(value => {
                callback(value);
            })
        }, true);

        if (pxt.Util.isTranslationMode()) {
            pxtblockly.external.setPromptTranslateBlock(dialogs.promptTranslateBlock);
        }
    }

    private initBlocklyToolbox() {
        let editor = this;
        /**
         * Move the toolbox to the edge.
         */
        const oldToolboxPosition = (Blockly as any).Toolbox.prototype.position;
        (Blockly as any).Toolbox.prototype.position = function () {
            oldToolboxPosition.call(this);
            editor.resizeToolbox();
        }

        /**
         * Override blockly methods to support our custom toolbox.
         */
        const that = this;
        (Blockly.WorkspaceSvg as any).prototype.refreshToolboxSelection = function () {
            let ws = this.isFlyout ? this.targetWorkspace : this;
            if (ws && !ws.currentGesture_ && ws.toolbox_ && ws.toolbox_.flyout_) {
                that.toolbox.refreshSelection();
            }
        };
        const oldHideChaff = (Blockly as any).hideChaff;
        (Blockly as any).hideChaff = function (opt_allowToolbox?: boolean) {
            oldHideChaff(opt_allowToolbox);
            if (!opt_allowToolbox) that.hideFlyout();
        };
    }

    private initWorkspaceSounds() {
        const editor = this;

        const oldAudioPlay = (Blockly as any).WorkspaceAudio.prototype.play;
        (Blockly as any).WorkspaceAudio.prototype.play = function (name: string, opt_volume?: number) {
            const themeVolume = pxt.appTarget?.appTheme?.blocklySoundVolume;

            if (editor?.parent.state.mute === MuteState.Muted) {
                opt_volume = 0;
            }
            else if (themeVolume != undefined) {
                if (opt_volume != undefined) {
                    opt_volume *= themeVolume;
                }
                else {
                    opt_volume = themeVolume;
                }
            }
            oldAudioPlay.call(this, name, opt_volume);
        };
    }

    private initAccessibleBlocks() {
        const enabled = pxt.appTarget.appTheme?.accessibleBlocks;
        if (enabled && !this.navigationController) {
            this.navigationController = new NavigationController() as any;

            this.navigationController.init();
            this.navigationController.addWorkspace(this.editor);

            (Navigation as any).prototype.focusToolbox = (workspace: Blockly.WorkspaceSvg) => {
                const toolbox = this.toolbox;
                if (!toolbox) return;
                this.focusToolbox();
                this.navigationController.navigation.resetFlyout(workspace, false);
                this.navigationController.navigation.setState(workspace, "toolbox");
            }
        }
    }

    public enableAccessibleBlocks(enable: boolean) {
        if (enable) {
            this.navigationController.enable(this.editor);
        } else {
            this.navigationController.disable(this.editor);
        }
    }

    private initWorkspaceSearch() {
        if (pxt.appTarget.appTheme.workspaceSearch && !this.workspaceSearch) {
            this.workspaceSearch = new pxtblockly.PxtWorkspaceSearch(this.editor);
            this.workspaceSearch.init();
            pxtblockly.external.setOpenWorkspaceSearch(() => {
                this.workspaceSearch.open();
            });
        }
    }

    private reportDeprecatedBlocks() {
        const deprecatedMap: pxt.Map<number> = {};
        let deprecatedBlocksFound = false;

        this.blockInfo.blocks.forEach(symbolInfo => {
            if (symbolInfo.attributes.deprecated) {
                deprecatedMap[symbolInfo.attributes.blockId] = 0;
            }
        });

        this.editor.getAllBlocks(false).forEach(block => {
            if (deprecatedMap[block.type] >= 0) {
                deprecatedMap[block.type]++;
                deprecatedBlocksFound = true;
            }
        });

        for (const block in deprecatedMap) {
            if (deprecatedMap[block] !== 0) {
                pxt.tickEvent("blocks.usingDeprecated", { block: block, count: deprecatedMap[block] });
            }
        }
    }

    public contentSize(): { height: number; width: number } {
        return this.editor ? pxtblockly.blocksMetrics(this.editor) : undefined;
    }

    private markIncomplete = false;
    isIncomplete() {
        const incomplete = this.editor?.isDragging();
        if (incomplete) this.markIncomplete = true;
        return incomplete;
    }

    prepare() {
        this.isReady = true
    }

    private prepareBlockly(forceHasCategories?: boolean) {
        pxt.perf.measureStart(Measurements.PrepareBlockly)
        let blocklyDiv = document.getElementById('blocksEditor');
        if (!blocklyDiv)
            return;
        pxsim.U.clear(blocklyDiv);

        // Increase the Blockly connection radius
        Blockly.config.snapRadius = 48;
        Blockly.config.connectingSnapRadius = 96;

        this.editor = Blockly.inject(blocklyDiv, this.getBlocklyOptions(forceHasCategories)) as Blockly.WorkspaceSvg;
        pxtblockly.contextMenu.setupWorkspaceContextMenu(this.editor);

        // set Blockly Colors
        (async () => {
            await Blockly.renderManagement.finishQueuedRenders();
            const blocklyColors = pxt.appTarget.appTheme.blocklyColors;
            if (blocklyColors) {
                const theme = this.editor.getTheme();
                for (const key of Object.keys(blocklyColors)) {
                    theme.setComponentStyle(key, blocklyColors[key]);
                }
                this.editor.setTheme(theme);
            }
        })();

        let shouldRestartSim = false;

        this.editor.addChangeListener((ev: any) => {
            Blockly.Events.disableOrphans(ev);

            // Blockly doesn't automatically resize highlight outlines. If an event
            // occurs that could have changed the size of a block, go ahead and refresh
            // the associated highlights
            if (ev.type === "block_field_intermediate_change" || ev.type === "change") {
                if (ev.blockId) {
                    const block = this.editor.getBlockById(ev.blockId);
                    fixHighlight(block);
                }
            }
            else if (ev.type === "drag") {
                for (const block of this.editor.getAllBlocks(false)) {
                    (block.pathObject as PathObject).resizeHighlight();
                }
            }

            const ignoredChanges = [
                Blockly.Events.UI,
                Blockly.Events.SELECTED,
                Blockly.Events.CLICK,
                Blockly.Events.VIEWPORT_CHANGE,
                Blockly.Events.BUBBLE_OPEN,
                Blockly.Events.THEME_CHANGE,
                pxtblockly.FIELD_EDITOR_OPEN_EVENT_TYPE
            ];

            if (shouldEventHideFlyout(ev)) {
                this.hideFlyout();
            }

            if ((ignoredChanges.indexOf(ev.type) === -1)
                || this.markIncomplete) {
                this.changeCallback();
                this.markIncomplete = false;
            }
            if (ev.type == Blockly.Events.CREATE) {
                let blockId = ev.xml.getAttribute('type');
                if (blockId == "variables_set") {
                    // Need to bump suffix in flyout
                    this.clearFlyoutCaches();
                }
                if (blockId === pxtc.TS_STATEMENT_TYPE || blockId === pxtc.TS_OUTPUT_TYPE) {
                    this.updateGrayBlocks();
                }
                pxt.tickEvent("blocks.create", { "block": blockId }, { interactiveConsent: true });
                if (ev.xml.tagName == 'SHADOW')
                    this.cleanUpShadowBlocks();
                if (!this.parent.state.tutorialOptions || !this.parent.state.tutorialOptions.metadata || !this.parent.state.tutorialOptions.metadata.flyoutOnly)
                    this.parent.setState({ hideEditorFloats: false });
                workspace.fireEvent({ type: 'create', editor: 'blocks', blockId } as pxt.editor.CreateEvent);
            }
            else if (ev.type == Blockly.Events.VAR_CREATE || ev.type == Blockly.Events.VAR_RENAME || ev.type == Blockly.Events.VAR_DELETE) {
                // a new variable name is used or blocks were removed,
                // clear the toolbox caches as some blocks may need to be recomputed
                this.clearFlyoutCaches();
            }
            else if (ev.type == Blockly.Events.UI) {
                if (ev.element == 'category') {
                    let toolboxVisible = !!ev.newValue;
                    if (toolboxVisible) pxt.setInteractiveConsent(true);
                    this.parent.setState({ hideEditorFloats: toolboxVisible });
                }
            }
            else if (ev.type === pxtblockly.FIELD_EDITOR_OPEN_EVENT_TYPE) {
                const openEvent = ev as pxtblockly.FieldEditorOpenEvent;
                if (openEvent.isOpen) {
                    shouldRestartSim = this.parent.state.simState != SimState.Stopped;
                    this.parent.stopSimulator();
                }
                else {
                    if (shouldRestartSim) {
                        this.parent.startSimulator();
                    }
                }
            }

            // reset tutorial hint animation on any blockly event
            if (this.parent.state.tutorialOptions != undefined) {
                this.parent.pokeUserActivity();
            }
        })

        this.editor.addChangeListener((e) => {
            if (e.type === Blockly.Events.BLOCK_MOVE) {
                const parent = this.editor.getBlockById((e as Blockly.Events.BlockMove).newParentId);
                if (parent && parent.isShadow()) {
                    Blockly.Events.setGroup(e.group)
                    const json = Blockly.serialization.blocks.save(parent);
                    // Dispose of the original block so it doesn't get saved in the parent connection's shadow state.
                    this.editor.getBlockById((e as Blockly.Events.BlockMove).blockId).dispose();
                    const dupe = Blockly.serialization.blocks.append(json, this.editor, { recordUndo: true });
                    parent.outputConnection.targetConnection.connect(dupe.outputConnection);
                    Blockly.Events.setGroup(false);
                }
            }
        })


        if (this.shouldShowCategories()) {
            this.renderToolbox();
        }
        this.hideFlyout();
        this.initPrompts();
        this.initBlocklyToolbox();
        this.initWorkspaceSounds();
        this.initAccessibleBlocks();
        this.initWorkspaceSearch();
        this.setupIntersectionObserver();
        this.resize();

        pxt.perf.measureEnd(Measurements.PrepareBlockly)
    }

    protected setupIntersectionObserver() {
        if (!('IntersectionObserver' in window) || this.intersectionObserver) return;

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.intersectionRatio > 0) {
                    this.intersectionObserver.unobserve(entry.target);
                    this.editor.refreshTheme();
                }
            })
        });
        const blocklyDiv = document.getElementById('blocksEditor');
        this.intersectionObserver.observe(blocklyDiv);
    }

    resize(e?: Event) {
        const blocklyArea = this.getBlocksAreaDiv();
        if (!blocklyArea) return;

        const blocklyDiv = this.getBlocksEditorDiv();
        // Position blocklyDiv over blocklyArea.
        if (blocklyDiv && this.editor) {
            Blockly.svgResize(this.editor);
            this.resizeToolbox();
            this.resizeFieldEditorView();
        }
    }

    resizeToolbox() {
        const blocklyDiv = this.getBlocksEditorDiv();
        if (!blocklyDiv) return;

        const blocklyToolboxDiv = this.getBlocklyToolboxDiv();
        if (!blocklyToolboxDiv) return;
        if (this.parent.isBlocksActive()) this.parent.updateEditorLogo(blocklyToolboxDiv.offsetWidth);

        const blocklyOptions = this.getBlocklyOptions(this.showCategories);
        if (!(blocklyOptions as any).horizontalLayout) blocklyToolboxDiv.style.height = `100%`;
    }

    protected resizeFieldEditorView() {
        if (!window) return;
        const blocklyDiv = this.getBlocksEditorDiv();
        const containerRect = blocklyDiv?.getBoundingClientRect();
        if (containerRect && this.parent.isTutorial() && containerRect.width > pxt.BREAKPOINT_TABLET) {
            blocklyFieldView.setEditorBounds({
                top: containerRect.top,
                left: containerRect.left,
                width: containerRect.width,
                height: containerRect.height
            });
        } else {
            // Full-screen editor
            blocklyFieldView.setEditorBounds({
                top: 0,
                left: 0,
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
    }

    hasUndo() {
        const undoStack = this.editor?.getUndoStack();
        const redoStack = this.editor?.getRedoStack();
        // undo is true if undoStack has items, or if both undo and redo are empty (first project load)
        return this.editor ? undoStack.length != 0
            || (undoStack.length == 0 && redoStack.length == 0) : false;
    }

    undo() {
        if (!this.editor) return;
        this.editor.undo(false);
        Blockly.hideChaff();
        this.parent.forceUpdate();
    }

    hasRedo() {
        return this.editor ? this.editor.getRedoStack().length != 0 : false;
    }

    redo() {
        if (!this.editor) return;
        this.editor.undo(true);
        Blockly.hideChaff();
        this.parent.forceUpdate();
    }

    zoomIn() {
        if (!this.editor) return;
        this.editor.zoomCenter(0.8);
    }

    zoomOut() {
        if (!this.editor) return;
        this.editor.zoomCenter(-0.8);
    }

    setScale(scale: number) {
        if (!this.editor) return;
        if (scale != this.editor.scale) {
            this.editor.setScale(scale);
        }
    }

    closeFlyout() {
        if (!this.editor) return;
        this.hideFlyout();
    }

    getId() {
        return "blocksArea"
    }

    display(): JSX.Element {
        let flyoutOnly = this.parent.state.editorState && this.parent.state.editorState.hasCategories === false;
        let showErrorList = pxt.appTarget.appTheme.blocksErrorList;
        return (
            <div className="blocksAndErrorList">
                <div className="blocksEditorOuter">
                    <div id="blocksEditor"></div>
                    <toolbox.ToolboxTrashIcon flyoutOnly={flyoutOnly} />
                </div>
                {showErrorList && <ErrorList isInBlocksEditor={true} listenToBlockErrorChanges={this.listenToBlockErrorChanges}
                    onSizeChange={this.onErrorListResize} />}
            </div>
        )
    }

    onErrorListResize() {
        this.parent.fireResize();
    }

    listenToBlockErrorChanges(handlerKey: string, handler: (errors: pxtblockly.BlockDiagnostic[]) => void) {
        this.errorChangesListeners[handlerKey] = handler;
    }

    private onBlockErrorChanges(errors: pxtblockly.BlockDiagnostic[]) {
        for (let listener of pxt.U.values(this.errorChangesListeners)) {
            listener(errors)
        }
    }

    getBlocksAreaDiv() {
        return document.getElementById('blocksArea');
    }

    getBlocksEditorDiv() {
        const blocksArea = this.getBlocksAreaDiv();
        return blocksArea ? document.getElementById('blocksEditor') : undefined;
    }

    getBlocklyToolboxDiv(): HTMLDivElement {
        const blocksArea = this.getBlocksAreaDiv();
        return blocksArea ? blocksArea.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLDivElement : undefined;
    }

    handleToolboxRef = (c: toolbox.Toolbox) => {
        this.toolbox = c;
    }

    handleDebuggerToolboxRef = (c: DebuggerToolbox) => {
        this.debuggerToolbox = c;
    }

    public moveFocusToFlyout() {
        if (this.navigationController) {
            this.navigationController.navigation.focusFlyout(this.editor);
        }

        (this.editor.getInjectionDiv() as HTMLDivElement).focus();
    }

    renderToolbox(immediate?: boolean) {
        if (pxt.shell.isReadOnly()) return;
        const blocklyToolboxDiv = this.getBlocklyToolboxDiv();
        const blocklyToolbox = <div className="blocklyToolbox">
            <toolbox.Toolbox ref={this.handleToolboxRef} editorname="blocks" parent={this} />
            {<div id="debuggerToolbox"></div>}
        </div>;
        Util.assert(!!blocklyToolboxDiv);
        ReactDOM.render(blocklyToolbox, blocklyToolboxDiv);

        if (!immediate) this.toolbox.showLoading();
    }

    updateToolbox() {
        const container = document.getElementById('debuggerToolbox');
        if (!container) return;

        pxt.perf.measureStart(Measurements.UpdateToolbox)
        const debugging = !!this.parent.state.debugging;
        let debuggerToolbox = debugging ? <DebuggerToolbox
                ref={this.handleDebuggerToolboxRef}
                parent={this.parent}
                apis={this.blockInfo.apis.byQName}
                showCallStack={experiments.isEnabled("advancedBlockDebugger")}
            /> : <div />;

        if (debugging) {
            this.toolbox.hide();
            // unselect any highlighted block
            (Blockly.getSelected() as Blockly.BlockSvg)?.unselect();
        } else {
            this.debuggerToolbox = null;
            this.toolbox.show();
        }
        ReactDOM.render(debuggerToolbox, container);
        pxt.perf.measureEnd(Measurements.UpdateToolbox)
    }

    showPackageDialog() {
        pxt.tickEvent("blocks.addpackage");
        if (this.editor.getToolbox()) this.editor.getToolbox().clearSelection();
        this.parent.showPackageDialog();
    }

    showVariablesFlyout() {
        this.showFlyoutInternal_(Blockly.Variables.flyoutCategory(this.editor), "variables");
    }

    showFunctionsFlyout() {
        this.showFlyoutInternal_(pxtblockly.createFunctionsFlyoutCategory(this.editor), "functions");
    }

    getViewState() {
        // ZOOM etc
        return {}
    }

    setViewState(pos: {}) { }

    getCurrentSource() {
        return this.editor && !this.delayLoadXml ? this.saveBlockly() : this.currSource;
    }

    acceptsFile(file: pkg.File) {
        return file.getExtension() == "blocks"
    }

    overrideFile(content: string) {
        if (this.delayLoadXml) {
            this.delayLoadXml = content;
            this.currSource = content;
        } else {
            this.loadBlockly(content);
        }
    }

    // TODO: remove this, we won't use it anymore
    insertBreakpoint() {
        if (!this.editor) return;
        const b = this.editor.newBlock(pxtc.TS_DEBUGGER_TYPE) as Blockly.BlockSvg;
        // move block roughly to the center of the screen
        const m = this.editor.getMetrics();
        b.moveBy(m.viewWidth / 2, m.viewHeight / 3);
        b.initSvg();
        b.queueRender();
    }

    private _loadBlocklyPromise: Promise<void>;
    loadBlocklyAsync() {
        if (!this._loadBlocklyPromise) {
            pxt.perf.measureStart(Measurements.LoadBlockly)
            pxtblockly.applyMonkeyPatches();
            this._loadBlocklyPromise = pxt.BrowserUtils.loadBlocklyAsync()
                .then(() => {
                    // Initialize the "Make a function" button
                    pxtblockly.FunctionManager.getInstance().setEditFunctionExternal((mutation: Element, cb: (mutation: Element) => void) => {
                        Util.delay(10)
                            .then(() => {
                                if (!this.functionsDialog) {
                                    const wrapper = document.body.appendChild(document.createElement('div'));
                                    this.functionsDialog = ReactDOM.render(React.createElement(CreateFunctionDialog, { parent: this.parent }), wrapper) as CreateFunctionDialog;
                                }
                                this.functionsDialog.show(mutation, cb, this.editor);
                            });
                    })

                    pxtblockly.external.setOpenHelpUrl((url: string) => {
                        pxt.tickEvent("blocks.help", { url }, { interactiveConsent: true });
                        const m = /^\/pkg\/([^#]+)#(.+)$/.exec(url);
                        if (m) {
                            const dep = pkg.mainPkg.deps[m[1]];
                            if (dep && dep.verProtocol() == "github") {
                                // rewrite url to point to current endpoint
                                url = `/pkg/${dep.verArgument().replace(/#.*$/, '')}#${m[2]}`;
                                window.open(url, m[1]);
                                return; // TODO support serving package docs in docs frame.
                            }
                        };
                        if (/^github:/.test(url)) {
                            // strip 'github:', add '.md' file extension if necessary
                            url = url.replace(/^github:\/?/, '') + (/\.md$/i.test(url) ? "" : ".md");
                            const content = resolveLocalizedMarkdown(url);
                            if (content) {
                                this.parent.setSideMarkdown(content);
                                this.parent.setSideDocCollapsed(false);
                            }
                        } else if (/^\//.test(url)) {
                            this.parent.setSideDoc(url);
                        } else {
                            window.open(url, 'docs');
                        }
                    });
                    this.prepareBlockly();
                })
                .then(() => initEditorExtensionsAsync())
                .then(() => pxt.perf.measureEnd(Measurements.LoadBlockly));
        }
        return this._loadBlocklyPromise;
    }

    loadFileAsync(file: pkg.File): Promise<void> {
        Util.assert(!this.delayLoadXml);
        const init = this.loadingXmlPromise || Promise.resolve();

        return init
            .then(() => this.loadBlocklyAsync())
            .then(() => {
                pxtblockly.cleanBlocks();

                if (this.toolbox) this.toolbox.showLoading();
                this.blockInfo = undefined;
                this.currSource = file.content;
                this.typeScriptSaveable = false;
                this.setDiagnostics(file)
                this.delayLoadXml = file.content;
                // serial editor is more like an overlay than a custom editor, so preserve blocks undo stack
                if (!this.parent.shouldPreserveUndoStack()) pxtblockly.clearWithoutEvents(this.editor);
                this.closeFlyout();

                this.filterToolbox();
                if (this.parent.state.editorState && this.parent.state.editorState.hasCategories != undefined) {
                    this.showCategories = this.parent.state.editorState.hasCategories;
                } else {
                    this.showCategories = true;
                }
                this.currFile = file;
                // Clear the search field if a value exists
                let searchField = document.querySelector("input.blocklySearchInput") as HTMLInputElement;
                if (searchField && searchField.value) {
                    searchField.value = '';
                }
                // Get extension packages
                this.extensions = (!!pxt.appTarget.appTheme.allowPackageExtensions
                    && pkg.allEditorPkgs()
                        .map(ep => ep.getKsPkg())
                        // Make sure the package has extensions enabled.
                        .filter(p => !!p?.config?.extension))
                    || [];
            })
    }

    unloadFileAsync(): Promise<void> {
        this.delayLoadXml = undefined;
        if (this.toolbox) this.toolbox.clearSearch();
        return Promise.resolve();
    }

    public switchToTypeScript() {
        pxt.tickEvent("blocks.switchjavascript");
        this.parent.closeFlyout();
        this.parent.switchTypeScript();
    }

    setDiagnostics(file: pkg.File) {
        Util.assert(this.editor != undefined); // Guarded
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return;

        // clear previous warnings on non-disabled blocks
        this.editor.getAllBlocks(false).filter(b => b.isEnabled()).forEach((b: Blockly.BlockSvg) => {
            b.setWarningText(null, pxtblockly.PXT_WARNING_ID);
            setHighlightWarningAsync(b, false);
        });
        let tsfile = file && file.epkg && file.epkg.files[file.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME)];
        if (!tsfile || !tsfile.diagnostics) return;

        // only show errors
        let diags = tsfile.diagnostics.filter(d => d.category == ts.pxtc.DiagnosticCategory.Error);
        let sourceMap = this.compilationResult.sourceMap;

        diags.filter(diag => diag.category == ts.pxtc.DiagnosticCategory.Error).forEach(diag => {
            let bid = pxtblockly.findBlockIdByLine(sourceMap, { start: diag.line, length: 0 });
            if (bid) {
                let b = this.editor.getBlockById(bid) as Blockly.BlockSvg;
                if (b) {
                    let txt = ts.pxtc.flattenDiagnosticMessageText(diag.messageText, "\n");
                    b.setWarningText(txt, pxtblockly.PXT_WARNING_ID);
                    setHighlightWarningAsync(b, true);
                }
            }
        })
        this.compilationResult.diagnostics.forEach(d => {
            if (d.blockId) {

                let b = this.editor.getBlockById(d.blockId) as Blockly.BlockSvg;

                if (b) {
                    b.setWarningText(d.message, pxtblockly.PXT_WARNING_ID);
                    setHighlightWarningAsync(b, true);
                }
            }
        })
        this.onBlockErrorChanges(this.compilationResult.diagnostics);
        this.setBreakpointsFromBlocks();
    }

    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage): boolean {
        if (!this.compilationResult || this.delayLoadXml || this.loadingXml)
            return false;
        this.updateDebuggerVariables(brk);
        this.highlightedStatement = stmt;
        if (stmt) {
            let bid = pxtblockly.findBlockIdByLine(this.compilationResult.sourceMap, { start: stmt.line, length: stmt.endLine - stmt.line });
            if (bid) {
                const parent = this.editor.getBlockById(bid).getRootBlock();
                bid = parent?.isCollapsed() ? parent.id : bid;
                this.editor.highlightBlock(bid);
                if (brk) {
                    const b = this.editor.getBlockById(bid) as Blockly.BlockSvg;
                    b.setWarningText(brk ? brk.exceptionMessage : undefined, pxtblockly.PXT_WARNING_ID);
                    // ensure highlight is in the screen when a breakpoint info is available
                    // TODO: make warning mode look good
                    // b.setHighlightWarning(brk && !!brk.exceptionMessage);
                    const p = b.getRelativeToSurfaceXY();
                    const c = b.getHeightWidth();
                    const s = this.editor.scale;
                    const m = this.editor.getMetrics();
                    // don't center if block is still on the screen
                    const marginx = 4;
                    const marginy = 4;
                    if (p.x * s < m.viewLeft + marginx
                        || (p.x + c.width) * s > m.viewLeft + m.viewWidth - marginx
                        || p.y * s < m.viewTop + marginy
                        || (p.y + c.height) * s > m.viewTop + m.viewHeight - marginy) {
                        // move the block towards the center
                        this.editor.centerOnBlock(bid);
                    }
                }
                return true;
            }
        } else {
            this.editor.highlightBlock(null);
            return false;
        }
        return false;
    }

    updateDebuggerVariables(brk: pxsim.DebuggerBreakpointMessage) {
        if (!this.parent.state.debugging) return;

        if (this.debuggerToolbox) {
            const visibleVars = Blockly.Variables.allUsedVarModels(this.editor)
                .map((variable: Blockly.VariableModel) => pxtc.escapeIdentifier(variable.name));

            this.debuggerToolbox.setBreakpoint(brk, visibleVars);
        }
    }

    clearHighlightedStatements() {
        this.editor.highlightBlock(null);
        if (this.debuggerToolbox) this.debuggerToolbox.setBreakpoint(null);
    }

    openTypeScript() {
        pxt.tickEvent("blocks.showjavascript");
        this.parent.closeFlyout();
        this.parent.openTypeScriptAsync();
    }

    openPython() {
        pxt.tickEvent("blocks.showpython");
        this.parent.closeFlyout();
        this.parent.openPythonAsync();
    }

    private cleanUpShadowBlocks() {
        const blocks = this.editor.getTopBlocks(false);
        blocks.filter(b => b.isShadow()).forEach(b => b.dispose(false));
    }

    private getBlocklyOptions(forceHasCategories?: boolean) {
        let blocklyOptions = { ...this.getDefaultOptions() };
        Util.jsonMergeFrom(blocklyOptions, pxt.appTarget.appTheme.blocklyOptions || {});
        const hasCategories = (forceHasCategories != undefined) ? forceHasCategories :
            this.showCategories

        blocklyOptions.renderer = "pxt";
        if (!hasCategories) {
            this.showCategories = false;
            delete blocklyOptions.plugins["flyoutsVerticalToolbox"];
        }
        // If we're using categories, show the category toolbox, otherwise show the flyout toolbox
        const toolbox = hasCategories ?
            document.getElementById('blocklyToolboxDefinitionCategory')
            : document.getElementById('blocklyToolboxDefinitionFlyout');
        blocklyOptions['toolbox'] = blocklyOptions.toolbox != undefined ?
            blocklyOptions.toolbox : blocklyOptions.readOnly ? undefined : toolbox;
        return blocklyOptions;
    }

    private blocklyOptionsCache: Blockly.BlocklyOptions;
    private getDefaultOptions() {
        if (this.blocklyOptionsCache) return this.blocklyOptionsCache;
        const readOnly = pxt.shell.isReadOnly();
        const theme = pxt.appTarget.appTheme;
        const blocklyOptions: Blockly.BlocklyOptions = {
            media: pxt.webConfig.commitCdnUrl + "blockly/media/",
            sounds: true,
            trashcan: false,
            collapse: !!theme.blocksCollapsing,
            comments: true,
            disable: false,
            readOnly: readOnly,
            plugins: {
                'blockDragger': pxtblockly.BlockDragger,
                'connectionChecker': DuplicateOnDragConnectionChecker,
                'flyoutsVerticalToolbox': pxtblockly.VerticalFlyout,
                'connectionPreviewer': pxtblockly.ConnectionPreviewer
            },
            move: {
                scrollbars: true,
                wheel: true
            },
            zoom: {
                controls: false,
                maxScale: 2.5,
                minScale: .2,
                scaleSpeed: 1.5,
                startScale: pxt.BrowserUtils.isMobile() ? 0.7 : 0.9,
                pinch: true,
                wheel: true
            },
            rtl: Util.isUserLanguageRtl()
        };
        this.blocklyOptionsCache = blocklyOptions;
        return blocklyOptions;
    }

    private refreshToolbox() {
        if (!this.blockInfo) return;
        pxt.perf.measureStart(Measurements.RefreshToolbox)
        // no toolbox when readonly
        if (pxt.shell.isReadOnly()) return;

        // Dont show toolbox if we're in tutorial mode and we're not ready
        if (this.parent.state.tutorialOptions != undefined &&
            !this.parent.state.tutorialOptions.tutorialReady) {
            return;
        }

        this.clearCaches();

        const forceFlyoutOnly = this.parent.state.editorState && this.parent.state.editorState.hasCategories === false;
        const hasCategories = this.shouldShowCategories(!forceFlyoutOnly);

        // We might need to switch the toolbox type
        if (this.editor.options.hasCategories === hasCategories) {
            // Toolbox is consistent with current mode, safe to update
            if (hasCategories) {
                this.toolbox.setState({ loading: false, categories: this.getAllCategories(), showSearchBox: this.shouldShowSearch() });
            } else {
                this.showFlyoutOnlyToolbox();
            }
        } else {
            // Toolbox mode is different, need to refresh.
            if (!hasCategories) {
                // If we're switching from a toolbox to no toolbox, unmount node
                ReactDOM.unmountComponentAtNode(this.getBlocklyToolboxDiv());
            }

            const refreshBlockly = () => {
                this.delayLoadXml = this.getCurrentSource();
                this.editor = undefined;
                this.prepareBlockly(hasCategories);
                this.domUpdate();
                this.editor.scrollCenter();
                if (hasCategories) {
                    // If we're switching from no toolbox to a toolbox, mount node
                    this.renderToolbox(true);
                }
            };

            if (this.loadingXmlPromise) {
                // enqueue refresh if currently loading
                this.loadingXmlPromise
                    .then(refreshBlockly);
            } else {
                refreshBlockly();
            }
        }
        pxt.perf.measureEnd(Measurements.RefreshToolbox)
    }

    filterToolbox(showCategories?: boolean) {
        this.showCategories = showCategories;
        this.refreshToolbox();
    }

    private async openExtension(extensionName: string) {
        const pkg = this.extensions.filter(c => c.config.name === extensionName)[0];
        if (!pkg?.config.extension)
            return;
        pxt.tickEvent('blocks.extensions.open', { extension: extensionName })

        const { name, url, trusted } = await resolveExtensionUrl(pkg);

        // should never happen
        if (!trusted) {
            core.errorNotification(lf("Sorry, this extension is not allowed."))
            pxt.tickEvent('blocks.extensions.untrusted', { extension: extensionName })
            return;
        }

        pxt.tickEvent('blocks.extensions.trusted', { extension: extensionName })
        this.parent.openExtension(name, url);
    }

    private partitionBlocks() {
        const res: pxt.Map<toolbox.BlockDefinition[]> = {};
        this.topBlocks = [];

        const that = this;
        function setSubcategory(ns: string, subcat: string) {
            if (!that.subcategoryMap[ns]) that.subcategoryMap[ns] = {};
            that.subcategoryMap[ns][subcat] = true;
        }

        pxtblockly.injectBlocks(this.blockInfo).forEach(fn => {
            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];

            if (!res[ns]) {
                res[ns] = [];
            }
            res[ns].push(fn);

            const subcat = fn.attributes.subcategory;
            const advanced = fn.attributes.advanced;

            if (advanced) {
                // More subcategory
                setSubcategory(ns, lf("more"));
            } else if (subcat) {
                setSubcategory(ns, subcat);
            }

            if (fn.attributes.topblock) {
                this.topBlocks.push(fn);
            }
        });

        return res;
    }

    public hideFlyout() {
        if (this.editor.getToolbox()) {
            this.editor.getFlyout().hide();
        }
        if (this.toolbox) this.toolbox.clear();
    }

    ///////////////////////////////////////////////////////////
    ////////////         Toolbox methods          /////////////
    ///////////////////////////////////////////////////////////

    clearCaches() {
        super.clearCaches();
        this.clearFlyoutCaches();
        snippets.clearBuiltinBlockCache();
        // note that we don't need to clear the flyout SVG cache since those
        // will regenerate themselves more precisely based on the hash of the
        // input blocks xml.
    }

    clearFlyoutCaches() {
        this.flyoutBlockXmlCache = {};
    }

    shouldShowSearch() {
        if (this.parent.state.editorState && this.parent.state.editorState.searchBar != undefined) {
            return this.parent.state.editorState.searchBar;
        }
        return true;
    }

    shouldShowCategories(forceHasCategories?: boolean) {
        if (this.parent.state.editorState && this.parent.state.editorState.hasCategories != undefined) {
            return this.parent.state.editorState.hasCategories;
        }
        return true;
    }

    getBuiltinCategory(ns: string): toolbox.ToolboxCategory {
        return snippets.getBuiltinCategory(ns);
    }

    isBuiltIn(ns: string): boolean {
        return snippets.isBuiltin(ns);
    }

    getNamespaceAttrs(ns: string) {
        const builtin = snippets.getBuiltinCategory(ns);
        if (builtin) {
            builtin.attributes.color = pxt.toolbox.getNamespaceColor(builtin.nameid);
            return builtin.attributes;
        }
        if (!this.blockInfo) return undefined;

        return super.getNamespaceAttrs(ns);
    }

    getNamespaces() {
        const namespaces = Object.keys(this.nsMap)
            .filter(ns => !snippets.isBuiltin(ns) && !!this.getNamespaceAttrs(ns));

        function isRemoved(ns: string): boolean {
            return snippets.getBuiltinCategory(ns).removed;
        }

        let config = pxt.appTarget.runtime || {};
        if (config.loopsBlocks && !isRemoved(toolbox.CategoryNameID.Loops)) namespaces.push(toolbox.CategoryNameID.Loops);
        if (config.logicBlocks && !isRemoved(toolbox.CategoryNameID.Logic)) namespaces.push(toolbox.CategoryNameID.Logic);
        if (config.variablesBlocks && !isRemoved(toolbox.CategoryNameID.Variables)) namespaces.push(toolbox.CategoryNameID.Variables);
        if (config.mathBlocks && !isRemoved(toolbox.CategoryNameID.Maths)) namespaces.push(toolbox.CategoryNameID.Maths);
        if (config.functionBlocks && !isRemoved(toolbox.CategoryNameID.Functions)) namespaces.push(toolbox.CategoryNameID.Functions);
        if (config.listsBlocks && !isRemoved(toolbox.CategoryNameID.Arrays)) namespaces.push(toolbox.CategoryNameID.Arrays);
        if (config.textBlocks && !isRemoved(toolbox.CategoryNameID.Text)) namespaces.push(toolbox.CategoryNameID.Text);

        if (pxt.appTarget.cloud && pxt.appTarget.cloud.packages) {
            namespaces.push(toolbox.CategoryNameID.Extensions);
        }

        return namespaces.concat(super.getNamespaces());
    }

    ///////////////////////////////////////////////////////////
    ////////////         Flyout methods           /////////////
    ///////////////////////////////////////////////////////////

    public getBlocksForCategory(ns: string, subns?: string): (toolbox.BlockDefinition | toolbox.ButtonDefinition)[] {
        if (!snippets.isBuiltin(ns)) {
            return this.getNonBuiltInBlocks(ns, subns).concat(this.getExtraBlocks(ns, subns));
        } else {
            return this.getBuiltInBlocks(ns, subns).concat(this.getExtraBlocks(ns, subns));
        }
    }

    private filterBlocks(subns: string, blocks: toolbox.BlockDefinition[]) {
        if (!blocks) return [];
        return blocks.filter((block => !(block.attributes.blockHidden)
            && !(block.attributes.deprecated && !this.parent.isTutorial())
            && ((!subns && !block.attributes.subcategory && !block.attributes.advanced)
                || (subns && ((block.attributes.advanced && subns == lf("more"))
                    || (block.attributes.subcategory && subns == block.attributes.subcategory))))));
    }

    private getBuiltInBlocks(ns: string, subns: string) {
        let cat = snippets.getBuiltinCategory(ns);
        let blocks: toolbox.BlockDefinition[] = cat.blocks || [];
        if (!cat.custom && this.nsMap[ns]) {
            blocks = this.filterBlocks(subns, blocks.concat(this.nsMap[ns]));
        }
        return blocks;
    }

    private getNonBuiltInBlocks(ns: string, subns: string) {
        return this.filterBlocks(subns, this.nsMap[ns]) || [];
    }

    private getExtraBlocks(ns: string, subns: string) {
        if (subns) return [];
        let extraBlocks: (toolbox.BlockDefinition | toolbox.ButtonDefinition)[] = [];
        const onStartNamespace = pxt.appTarget.runtime.onStartNamespace || "loops";
        if (ns == onStartNamespace) {
            extraBlocks.push({
                name: ts.pxtc.ON_START_TYPE,
                snippetName: "on start",
                attributes: {
                    blockId: ts.pxtc.ON_START_TYPE,
                    weight: pxt.appTarget.runtime.onStartWeight || 10,
                    group: pxt.appTarget.runtime.onStartGroup || undefined
                },
                blockXml: `<block type="pxt-on-start"></block>`
            });
        }

        // Inject pause until block
        const pauseUntil = snippets.getPauseUntil();
        if (pauseUntil && ns == pauseUntil.attributes.blockNamespace) {
            extraBlocks.push(pauseUntil);
        }
        // Add extension buttons
        if (!subns) {
            this.extensions.forEach(extension => {
                const config = extension.config;
                const name = config.name;
                const namespace = config.extension.namespace || name;
                if (ns == namespace) {
                    extraBlocks.push({
                        name: `EXT${name}_BUTTON`,
                        type: "button",
                        attributes: {
                            blockId: `EXT${name}_BUTTON`,
                            label: config.extension.label ? Util.rlf(config.extension.label) : Util.lf("Editor"),
                            weight: 101,
                            group: config.extension.group
                        },
                        callback: () => {
                            this.openExtension(name);
                        }
                    });
                }
            })
        }

        if (pxt.appTarget.appTheme.snippetBuilder) {
            // Push snippet extension into extraBlocks
            initializeSnippetExtensions(ns, extraBlocks, this.editor, this.parent);
        }

        return extraBlocks;
    }

    private flyoutBlockXmlCache: pxt.Map<Element[]> = {};
    private flyoutXmlList: Element[] = [];
    public showFlyout(treeRow: toolbox.ToolboxCategory) {
        const { nameid: ns, subns } = treeRow;

        if (ns == 'search') {
            this.showSearchFlyout();
            return;
        }

        if (ns == 'topblocks') {
            this.showTopBlocksFlyout();
            return;
        }

        const currTutorialStep = this.parent.state.tutorialOptions?.tutorialStep;
        const currTutorialStepInfo = currTutorialStep !== undefined ? this.parent.state.tutorialOptions.tutorialStepInfo[currTutorialStep] : undefined;
        const tutorialStepIsDynamic = currTutorialStepInfo?.localBlockConfig?.blocks?.length > 0;

        // Dont cache flyout xml for tutorial steps with blockconfig.local sections (because they introduce dynamic blocks), or when translating.
        const cachable = !tutorialStepIsDynamic && !pxt.Util.isTranslationMode();

        this.flyoutXmlList = [];
        const cacheKey = ns + subns + (currTutorialStepInfo ? "tutorialexpanded" : "");
        if (cachable && this.flyoutBlockXmlCache[cacheKey]) {
            pxt.debug("showing flyout with blocks from flyout blocks xml cache");
            this.flyoutXmlList = this.flyoutBlockXmlCache[cacheKey];
            this.showFlyoutInternal_(this.flyoutXmlList, cacheKey);
            return;
        }

        if (this.abstractShowFlyout(treeRow)) {
            if (cachable) {
                // Cache blocks xml list for later
                this.flyoutBlockXmlCache[cacheKey] = this.flyoutXmlList;
            }
            this.showFlyoutInternal_(this.flyoutXmlList, cacheKey);
        }
    }

    protected showFlyoutHeadingLabel(ns: string, name: string, subns: string, icon: string, color: string) {
        const categoryName = name || Util.capitalize(subns || ns);
        const iconClass = `blocklyTreeIcon${icon ? ns.toLowerCase() : 'Default'}`.replace(/\s/g, '');
        let headingLabel = pxtblockly.createFlyoutHeadingLabel(categoryName, color, icon, iconClass);
        this.flyoutXmlList.push(headingLabel);
    }

    protected showFlyoutGroupLabel(group: string, groupicon: string, labelLineWidth: string, helpCallback: string) {
        let groupLabel = pxtblockly.createFlyoutGroupLabel(pxt.Util.rlf(`{id:group}${group}`),
            groupicon, labelLineWidth, helpCallback ? `GROUP_HELP_${group}` : undefined);
        if (helpCallback) {
            this.editor.registerButtonCallback(`GROUP_HELP_${group}`, (/*btn*/) => {
                this.helpButtonCallback(group);
            })
        }
        this.flyoutXmlList.push(pxtblockly.createFlyoutGap(30));
        this.flyoutXmlList.push(groupLabel);
        this.flyoutXmlList.push(pxtblockly.createFlyoutGap(30));
    }

    protected helpButtonCallback(group?: string) {
        pxt.debug(`${group} help icon clicked.`);
        workspace.fireEvent({ type: 'ui', editor: 'blocks', action: 'groupHelpClicked', data: { group } } as pxt.editor.UIEvent);
    }

    protected showFlyoutBlocks(ns: string, color: string, blocks: toolbox.BlockDefinition[]) {
        const filters = this.parent.state.editorState ? this.parent.state.editorState.filters : undefined;
        blocks.sort((f1, f2) => {
            // Sort the blocks
            return (f2.attributes.weight != undefined ? f2.attributes.weight : 50)
                - (f1.attributes.weight != undefined ? f1.attributes.weight : 50);
        }).forEach((block) => {
            let blockXmlList: Element[];
            if (block.type == "button") {
                blockXmlList = this.getButtonXml(block as toolbox.ButtonDefinition);
            } else {
                blockXmlList = this.getBlockXml(block as toolbox.BlockDefinition);
            }
            if (blockXmlList) this.flyoutXmlList = this.flyoutXmlList.concat(blockXmlList);
        })
    }

    private showSearchFlyout() {
        this.flyoutXmlList = [];
        const searchBlocks = this.toolbox.getSearchBlocks();

        searchBlocks.forEach((block) => {
            const blockXmlList = this.getBlockXml(block, true);
            if (blockXmlList) this.flyoutXmlList = this.flyoutXmlList.concat(blockXmlList);
        })

        if (this.flyoutXmlList.length == 0) {
            let label = Blockly.utils.xml.createElement('label');
            label.setAttribute('text', lf("No search results..."));
            this.flyoutXmlList.push(label);
        }
        this.showFlyoutInternal_(this.flyoutXmlList, "search");
        this.toolbox.setSearch();
    }

    private showTopBlocksFlyout() {
        this.flyoutXmlList = [];
        const topBlocks = this.getTopBlocks();
        if (topBlocks.length == 0) {
            let label = Blockly.utils.xml.createElement('label');
            label.setAttribute('text', lf("No basic blocks..."));
            this.flyoutXmlList.push(label);
        } else {
            // Show a heading
            this.showFlyoutHeadingLabel('topblocks', lf("{id:category}Basic"), null,
                pxt.toolbox.getNamespaceIcon('topblocks'), pxt.toolbox.getNamespaceColor('topblocks'));

            topBlocks.forEach((block) => {
                const blockXmlList = this.getBlockXml(block, true);
                if (blockXmlList) this.flyoutXmlList = this.flyoutXmlList.concat(blockXmlList);
            })
        }
        this.showFlyoutInternal_(this.flyoutXmlList);
    }

    private showFlyoutInternal_(xmlList: Element[], flyoutName: string = "default") {
        const flyout = this.editor.getFlyout() as pxtblockly.VerticalFlyout;
        flyout.show(xmlList, flyoutName);
        flyout.scrollToStart();
    }

    // For editors that have no toolbox
    showFlyoutOnlyToolbox() {
        // Show a Flyout only with all the blocks
        const allCategories = this.getAllCategories();
        let allBlocks: toolbox.BlockDefinition[] = [];
        allCategories.forEach(category => {
            const blocks = category.blocks;
            allBlocks = allBlocks.concat(blocks);
            if (category.subcategories) category.subcategories.forEach(subcategory => {
                const subblocks = subcategory.blocks;
                allBlocks = allBlocks.concat(subblocks);
            })
        });

        let container = document.createElement("div");
        ReactDOM.render(<toolbox.ToolboxStyle categories={allCategories} />, container);
        document.getElementById('editorcontent').appendChild(container);

        let xmlList: Element[] = [];
        allBlocks.forEach((block) => {
            const blockXmlList = this.getBlockXml(block);
            if (blockXmlList) xmlList = xmlList.concat(blockXmlList);
        })
        this.showFlyoutInternal_(xmlList);
        this.parent.forceUpdate();
    }

    protected updateGrayBlocks() {
        if (this.editor) {
            const pythonEnabled = pxt.shell.isPyLangPref();
            this.editor.getAllBlocks(false).forEach(b => {
                if (b.type === pxtc.TS_STATEMENT_TYPE || b.type === pxtc.TS_OUTPUT_TYPE) {
                    (b as unknown as pxtblockly.GrayBlock).setPythonEnabled(pythonEnabled);
                }
            })
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////          Block methods           /////////////
    ///////////////////////////////////////////////////////////

    private getBlockXml(block: toolbox.BlockDefinition, ignoregap?: boolean, shadow?: boolean): Element[] {
        const that = this;
        let blockXml: Element;
        // Check if the block is built in, ignore it as it's already defined in snippets
        if (block.attributes.blockBuiltin) {
            pxt.log("ignoring built in block: " + block.attributes.blockId);
            return undefined;
        }
        if (block.builtinBlock) {
            // function_return is conditionally added to the toolbox, so it needs a special case
            if (block.attributes.blockId === "function_return") {
                return [pxtblockly.mkReturnStatementBlock()];
            }
            // Find the block XML for this built in block.
            const builtin = snippets.allBuiltinBlocks()[block.attributes.blockId];
            if (builtin && builtin.blockXml && block.builtinField && block.builtinField.length == 2) {
                // Likley a built in block with a mutatation, check the fields.
                const field = block.builtinField[0];
                const value = block.builtinField[1];
                const regExp = new RegExp(`<field name="${field}">(.*)<\/field>`, 'i');
                builtin.blockXml = builtin.blockXml.replace(regExp, () => {
                    return `<field name="${field}">${value}<\/field>`;
                });
            }
            return builtin ? this.getBlockXml(builtin, ignoregap) : undefined;
        }
        if (!block.blockXml) {
            let fn = pxtblockly.blockSymbol(block.attributes.blockId);
            if (fn) {
                if (!shouldShowBlock(fn)) return undefined;
                let comp = pxt.blocks.compileInfo(fn);

                function getBlockConfigXml(blockConfig: pxt.tutorial.TutorialBlockConfig): Element | undefined {
                    const entry = blockConfig.blocks.find(entry => entry.blockId === block.attributes.blockId);
                    if (entry) {
                        const xml = Blockly.utils.xml.textToDom(entry.xml);
                        xml.setAttribute("gap", `${pxt.appTarget.appTheme
                            && pxt.appTarget.appTheme.defaultBlockGap && pxt.appTarget.appTheme.defaultBlockGap.toString() || 8}`);
                        return xml;
                    }
                    return undefined;
                }

                // Check for custom config in scope of the current tutorial step.
                const currTutorialStep = this.parent.state.tutorialOptions?.tutorialStep;
                const currTutorialStepInfo = currTutorialStep !== undefined ? this.parent.state.tutorialOptions.tutorialStepInfo[currTutorialStep] : undefined;
                if (currTutorialStepInfo?.localBlockConfig?.blocks) {
                    blockXml = getBlockConfigXml(currTutorialStepInfo.localBlockConfig);
                }

                // Check for custom config in the tutorial's global scope.
                if (!blockXml && this.parent.state.tutorialOptions?.globalBlockConfig?.blocks) {
                    blockXml = getBlockConfigXml(this.parent.state.tutorialOptions.globalBlockConfig);
                }

                // Create the block XML from block definition.
                if (!blockXml) {
                    blockXml = pxtblockly.createToolboxBlock(this.blockInfo, fn, comp, shadow);

                    if (fn.attributes.optionalVariableArgs && fn.attributes.toolboxVariableArgs) {
                        const handlerArgs = comp.handlerArgs;
                        const mutationValues = fn.attributes.toolboxVariableArgs.split(";")
                            .map(v => parseInt(v))
                            .filter(v => v <= handlerArgs.length && v >= 0);

                        mutationValues.forEach(v => {
                            const mutation = document.createElement("mutation");
                            mutation.setAttribute("numargs", v.toString());
                            for (let i = 0; i < v; i++) {
                                mutation.setAttribute("arg" + i, handlerArgs[i].name)
                            }
                            blockXml.appendChild(mutation);
                        });
                    } else if (fn.attributes.mutateDefaults) {
                        const mutationValues = fn.attributes.mutateDefaults.split(";");
                        const mutatedBlocks: Element[] = [];
                        mutationValues.forEach(mutation => {
                            const mutatedBlock = blockXml.cloneNode(true) as HTMLElement;
                            pxtblockly.mutateToolboxBlock(mutatedBlock, fn.attributes.mutate, mutation);
                            mutatedBlocks.push(mutatedBlock);
                        });
                        return mutatedBlocks;
                    } else if (fn.attributes.blockSetVariable != undefined && fn.retType && !shadow) {
                        // if requested, wrap block into a "set variable block"
                        const rawName = fn.attributes.blockSetVariable;

                        let varName: string;

                        // By default if the API author does not put any value for blockSetVariable
                        // then our comment parser will fill in the string "true". This gets caught
                        // by isReservedWord() so no need to do a separate check.
                        if (!rawName || pxt.blocks.isReservedWord(rawName)) {
                            varName = Util.htmlEscape(fn.retType.toLowerCase());
                        }
                        else {
                            varName = Util.htmlEscape(rawName);
                        }
                        // since we are creating variable, generate a new name that does not
                        // clash with existing variable names
                        let varNameUnique = varName;
                        let index = 2;
                        while (variableIsAssigned(varNameUnique, this.editor)) {
                            varNameUnique = varName + index++;
                        }
                        varName = varNameUnique;

                        const setblock = Blockly.utils.xml.textToDom(`
                            <block type="variables_set" gap="${Util.htmlEscape((fn.attributes.blockGap || 8) + "")}">
                            <field name="VAR" variabletype="">${varName}</field>
                            </block>`);
                        {
                            let value = document.createElement('value');
                            value.setAttribute('name', 'VALUE');
                            value.appendChild(blockXml);
                            value.appendChild(pxtblockly.mkFieldBlock("math_number", "NUM", "0", true));
                            setblock.appendChild(value);
                        }
                        blockXml = setblock;
                    } else if (fn.attributes.duplicateWithToolboxParent) {
                        const blockWithParentFn = { ...fn, attributes: { ...fn.attributes, toolboxParent: fn.attributes.duplicateWithToolboxParent, toolboxParentArgument: fn.attributes.duplicateWithToolboxParentArgument } };
                        const duplicatedBlock = pxtblockly.createToolboxBlock(this.blockInfo, blockWithParentFn, comp);
                        return [duplicatedBlock, blockXml];
                    }
                }
            } else {
                pxt.log("Couldn't find block for: " + block.attributes.blockId);
                pxt.log(block);
            }
        } else {
            blockXml = Blockly.utils.xml.textToDom(block.blockXml);
        }
        if (blockXml) {
            if (ignoregap) {
                blockXml.setAttribute("gap", `${pxt.appTarget.appTheme
                    && pxt.appTarget.appTheme.defaultBlockGap && pxt.appTarget.appTheme.defaultBlockGap.toString() || 8}`);
            }
            pxt.Util.toArray(blockXml.querySelectorAll('shadow'))
                .filter(shadow => !shadow.innerHTML)
                .forEach((shadow, i) => {
                    let type = shadow.getAttribute('type');
                    if (type === block.type) return;
                    const builtin = snippets.allBuiltinBlocks()[type];
                    let b = this.getBlockXml(builtin ? builtin : { name: type, type: type, attributes: { blockId: type } }, ignoregap, true);
                    // Note: we're setting one innerHTML to another
                    // eslint-disable-next-line @microsoft/sdl/no-inner-html
                    if (b && b.length > 0 && b[0] && b[0].getAttribute("type") === type) shadow.innerHTML = b[0].innerHTML;
                })
        }
        return [blockXml];
        function shouldShowBlock(fn: pxtc.SymbolInfo) {
            if (fn.attributes.debug && !pxt.options.debug) return false;
            if (!shadow && fn.attributes.blockHidden) return false;
            if (fn.attributes.deprecated && !that.parent.isTutorial()) return false;
            let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
            return that.shouldShowBlock(fn.attributes.blockId, ns, shadow);
        }

        function variableIsAssigned(name: string, editor: Blockly.WorkspaceSvg) {
            const varModel = editor.getVariable(name);
            const varUses = varModel && editor.getVariableUsesById(varModel.getId());
            return varUses && varUses.some(b => b.type == "variables_set" || b.type == "variables_change");
        }
    }

    private getButtonXml(button: toolbox.ButtonDefinition): Element[] {
        this.editor.registerButtonCallback(button.attributes.blockId, (btn) => {
            button.callback();
        })
        return [pxtblockly.createFlyoutButton(button.attributes.blockId, button.attributes.label)];
    }

    updateBreakpoints() {
        if (!this.editor) return; // not loaded yet

        const debugging = !!this.parent.state.debugging;
        const blocks = this.editor.getAllBlocks(false);
        blocks.forEach(block => {
            if (block.previousConnection) {
                this.enableBreakpoint(block, debugging);
            }
        });

        this.editor.options.readOnly = debugging || pxt.shell.isReadOnly();
    }

    protected enableBreakpoint(block: Blockly.Block, enabled: boolean) {
        const existing = block.getIcon(pxtblockly.BreakpointIcon.type);
        if (enabled) {
            if (existing) return;
            block.addIcon(new pxtblockly.BreakpointIcon(block, this.onBreakpointClick));
        }
        else if (existing) {
            block.removeIcon(pxtblockly.BreakpointIcon.type);
        }
    }

    protected onBreakpointClick = (block: Blockly.Block, enabled: boolean) => {
        if (enabled) {
            this.addBreakpointFromEvent(block.id);
        }
        else {
            this.removeBreakpointFromEvent(block.id)
        }
    }
}

function forEachImageField(workspace: Blockly.Workspace, cb: (asset: pxtblockly.FieldAssetEditor<any, any>) => void) {
    const blocks = workspace.getAllBlocks(false);

    for (const block of blocks) {
        for (const input of block.inputList) {
            for (const field of input.fieldRow) {
                // No need to check for tilemap editor because those are never temporary
                if (field instanceof pxtblockly.FieldSpriteEditor || field instanceof pxtblockly.FieldAnimationEditor) {
                    cb(field)
                }
            }
        }
    }
}

function disposeOfTemporaryAssets(workspace: Blockly.Workspace) {
    forEachImageField(workspace, field => field.disposeOfTemporaryAsset());
}

function clearTemporaryAssetBlockData(workspace: Blockly.Workspace) {
    forEachImageField(workspace, field => field.clearTemporaryAssetData());
}

async function setHighlightWarningAsync(block: Blockly.BlockSvg, enabled: boolean) {
    (block.pathObject as PathObject).setHasError(enabled);
    block.setHighlighted(enabled);
    if (enabled) {
        await Blockly.renderManagement.finishQueuedRenders();
        (block.pathObject as PathObject).resizeHighlight();
    }
}

function isBreakpointSet(block: Blockly.BlockSvg) {
    const existing = block.getIcon(pxtblockly.BreakpointIcon.type) as pxtblockly.BreakpointIcon;
    return !!existing?.isEnabled();
}

function fixHighlight(block: Blockly.BlockSvg) {
    (block.pathObject as PathObject).resizeHighlight();

    const connectedTo = block.outputConnection?.targetBlock();

    if (connectedTo) {
        fixHighlight(connectedTo);
    }
}

function shouldEventHideFlyout(ev: Blockly.Events.Abstract) {
    if (ev.type === "var_create" || ev.type === "marker_move") {
        return false;
    }

    // If a block is selected when the user clicks on a flyout button (e.g. "Make a Variable"),
    // a selected event will fire unselecting the block before the var_create event is fired.
    // Make sure we don't close the flyout in the case where a block is simply being unselected.
    if (ev.type === "selected") {
        if (!(ev as Blockly.Events.Selected).newElementId) {
            return false;
        }
    }

    return true;
}

function resolveLocalizedMarkdown(url: string) {
    const editorPackage = pkg.getEditorPkg(pkg.mainPkg);

    const splitPath = url.split("/");
    const fileName = splitPath.pop();
    const dirName = splitPath.join("/");

    const [initialLang, baseLang, initialLangLowerCase] = pxt.Util.normalizeLanguageCode(pxt.Util.userLanguage());
    const priorityOrder = [initialLang, initialLangLowerCase, baseLang].filter((lang) => typeof lang === "string")
    const pathsToTest = [
        ...priorityOrder.map(lang =>`${dirName}/_locales/${lang}/${fileName}`),
        url
    ]

    for (const path of pathsToTest) {
        const file = editorPackage.lookupFile(path);
        const content = file?.content?.trim();

        if (content) {
            return content;
        }
    }

    return undefined;
}