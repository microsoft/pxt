/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export class EditorToolbar extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);

        this.saveProjectName = this.saveProjectName.bind(this);
        this.compile = this.compile.bind(this);
        this.saveFile = this.saveFile.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.zoomIn = this.zoomIn.bind(this);
        this.zoomOut = this.zoomOut.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.toggleTrace = this.toggleTrace.bind(this);
        this.toggleDebugging = this.toggleDebugging.bind(this);
        this.toggleCollapse = this.toggleCollapse.bind(this);
    }

    saveProjectName(name: string, view?: string) {
        pxt.tickEvent("editortools.projectrename", { view: view }, { interactiveConsent: true });
        this.props.parent.updateHeaderName(name);
    }

    compile(view?: string) {
        pxt.tickEvent("editortools.download", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.compile();
    }

    saveFile(view?: string) {
        pxt.tickEvent("editortools.save", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.saveAndCompile();
    }

    undo(view?: string) {
        pxt.tickEvent("editortools.undo", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.undo();
    }

    redo(view?: string) {
        pxt.tickEvent("editortools.redo", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.redo();
    }

    zoomIn(view?: string) {
        pxt.tickEvent("editortools.zoomIn", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.zoomIn();
    }

    zoomOut(view?: string) {
        pxt.tickEvent("editortools.zoomOut", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.zoomOut();
    }

    startStopSimulator(view?: string) {
        pxt.tickEvent("editortools.startStopSimulator", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.startStopSimulator({ clickTrigger: true });
    }

    restartSimulator(view?: string) {
        pxt.tickEvent("editortools.restart", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.restartSimulator();
    }

    toggleTrace(view?: string) {
        pxt.tickEvent("editortools.trace", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.toggleTrace();
    }

    toggleDebugging(view?: string) {
        pxt.tickEvent("editortools.debug", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    toggleCollapse(view?: string) {
        pxt.tickEvent("editortools.toggleCollapse", { view: view, collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorCollapse();
    }

    private getCollapsedState(): string {
        return '' + this.props.parent.state.collapseEditorTools;
    }

    private getHeadlessState(): string {
        return pxt.appTarget.simulator.headless ? "true" : "false";
    }

    renderCore() {
        const { home, tutorialOptions, hideEditorFloats, collapseEditorTools, projectName, compiling, isSaving, simState, debugging } = this.props.parent.state;

        if (home) return <div />; // Don't render if we're in the home screen

        const targetTheme = pxt.appTarget.appTheme;
        const sandbox = pxt.shell.isSandboxMode();
        const isController = pxt.shell.isControllerMode();
        const readOnly = pxt.shell.isReadOnly();
        const tutorial = tutorialOptions ? tutorialOptions.tutorial : false;
        const simOpts = pxt.appTarget.simulator;
        const headless = simOpts.headless;
        const collapsed = (hideEditorFloats || collapseEditorTools) && (!tutorial || headless);
        const isEditor = this.props.parent.isBlocksEditor() || this.props.parent.isTextEditor();
        if (!isEditor) return <div />;

        const disableFileAccessinMaciOs = targetTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac());
        const showSave = !readOnly && !isController && !targetTheme.saveInMenu && !tutorial && !debugging && !disableFileAccessinMaciOs;
        const compile = pxt.appTarget.compile;
        const compileBtn = compile.hasHex || compile.saveAsPNG || compile.useUF2;
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const compileLoading = !!compiling;
        const running = simState == pxt.editor.SimState.Running;
        const starting = simState == pxt.editor.SimState.Starting;
        const runTooltip = [lf("Start the simulator"), lf("Starting the simulator"), lf("Stop the simulator")][simState || 0];
        const restartTooltip = lf("Restart the simulator");
        const collapseTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        const pairingButton = !!targetTheme.pairingButton;

        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();

        const showCollapsed = !tutorial && !sandbox && !targetTheme.simCollapseInMenu;
        const showProjectRename = !tutorial && !readOnly && !isController && !targetTheme.hideProjectRename && !debugging;
        const showUndoRedo = !tutorial && !readOnly && !debugging;
        const showZoomControls = true;

        const run = !targetTheme.bigRunButton;
        const restart = run && !simOpts.hideRestart;
        const trace = !!targetTheme.enableTrace;
        const tracing = this.props.parent.state.tracing;
        const traceTooltip = tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo")
        const debug = !!targetTheme.debugger && !readOnly;
        const debugTooltip = debugging ? lf("Disable Debugging") : lf("Debugging")
        const downloadIcon = pxt.appTarget.appTheme.downloadIcon || "download";
        const downloadText = pxt.appTarget.appTheme.useUploadMessage ? lf("Upload") : lf("Download");

        const bigRunButtonTooltip = [lf("Stop"), lf("Starting"), lf("Run Code in Game")][simState || 0];

        let downloadButtonClasses = "";
        let saveButtonClasses = "";
        if (isSaving) {
            downloadButtonClasses = "disabled";
            saveButtonClasses = "loading disabled";
        } else if (compileLoading) {
            downloadButtonClasses = "loading disabled";
            saveButtonClasses = "disabled";
        }

        const isRtl = pxt.Util.isUserLanguageRtl();
        return <div className="ui equal width grid right aligned padded">
            <div className="column mobile only">
                {collapsed ?
                    <div className="ui grid">
                        {!targetTheme.bigRunButton ? <div className="left aligned column six wide">
                            <div className="ui icon small buttons">
                                {showCollapsed ? <EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='mobile' /> : undefined}
                                {headless && run ? <EditorToolbarButton className={`play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='mobile' /> : undefined}
                                {headless && restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='mobile' /> : undefined}
                                {headless && trace ? <EditorToolbarButton key='tracebtn' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='mobile' /> : undefined}
                                {headless && debug ? <EditorToolbarButton key='debugbtn' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='mobile' /> : undefined}
                                {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} ariaLabel={lf("Download your code")} onButtonClick={this.compile} view='mobile' /> : undefined}
                            </div>
                        </div> : undefined}
                        <div className={`column right aligned ${targetTheme.bigRunButton ? 'sixteen' : 'ten'} wide`}>
                            {!readOnly ?
                                <div className="ui icon small buttons">
                                    {showSave ? <EditorToolbarButton icon='save' className={`editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='mobile' /> : undefined}
                                    {showUndoRedo ? <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='mobile' /> : undefined}
                                </div> : undefined}
                            {showZoomControls ?
                                <div className="ui icon small buttons">
                                    <EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view='mobile' />
                                    <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view='mobile' />
                                </div> : undefined}
                            {targetTheme.bigRunButton ?
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='mobile' />
                                </div> : undefined}
                        </div>
                    </div> :
                    <div className="ui equal width grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <EditorToolbarButton className={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='mobile' /> : undefined}
                                {restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='mobile' /> : undefined}
                            </div>
                            {showCollapsed ?
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        <EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} ariaLabel={lf("{0}, {1}", collapseTooltip, collapsed ? lf("Collapsed") : "Expanded")} onButtonClick={this.toggleCollapse} view='mobile' />
                                    </div>
                                </div> : undefined}
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="column">
                            <div className="ui grid">
                                {readOnly || !showUndoRedo ? undefined :
                                    <div className="row">
                                        <div className="column">
                                            <div className="ui icon large buttons">
                                                <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='mobile' />
                                            </div>
                                        </div>
                                    </div>}
                                <div className="row" style={readOnly || !showUndoRedo ? undefined : { paddingTop: 0 }}>
                                    <div className="column">
                                        <div className="ui icon large buttons">
                                            {trace ? <EditorToolbarButton key='tracebtn' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='mobile' /> : undefined}
                                            {debug ? <EditorToolbarButton key='debugbtn' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='mobile' /> : undefined}
                                            {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} onButtonClick={this.compile} view='mobile' /> : undefined}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>}
            </div>
            <div className="column tablet only">
                {collapsed ?
                    <div className="ui grid seven column">
                        {headless ?
                            <div className="left aligned six wide column">
                                <div className="ui icon buttons">
                                    {showCollapsed ? <EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='tablet' /> : undefined}
                                    {run ? <EditorToolbarButton role="menuitem" className={`play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='tablet' /> : undefined}
                                    {restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='tablet' /> : undefined}
                                    {trace ? <EditorToolbarButton key='tracebtn' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='tablet' /> : undefined}
                                    {debug ? <EditorToolbarButton key='debug' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='tablet' /> : undefined}
                                    {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} onButtonClick={this.compile} view='tablet' /> : undefined}
                                </div>
                            </div> :
                            <div className="left aligned six wide column">
                                <div className="ui icon buttons">
                                    {showCollapsed ? <EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='tablet' /> : undefined}
                                    {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='tablet' /> : undefined}
                                </div>
                            </div>}
                        {showSave ? <div className="column four wide">
                            <EditorToolbarButton icon='save' className={`small editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='tablet' />
                        </div> : undefined}
                        <div className={`column ${showSave ? 'six' : 'ten'} wide right aligned`}>
                            {showUndoRedo ?
                                <div className="ui icon small buttons">
                                    <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='tablet' />
                                    <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Red"), !hasRedo ? lf("Disabled") : "")} title={lf("Redo")} onButtonClick={this.redo} view='tablet' />
                                </div> : undefined}
                            {showZoomControls ?
                                <div className="ui icon small buttons">
                                    <EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view='tablet' />
                                    <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view='tablet' />
                                </div> : undefined}
                            {targetTheme.bigRunButton ?
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='tablet' />
                                </div> : undefined}
                        </div>
                    </div>
                    : <div className="ui grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <EditorToolbarButton role="menuitem" className={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='tablet' /> : undefined}
                                {restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='tablet' /> : undefined}
                            </div>
                            {showCollapsed ?
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        <EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} ariaLabel={lf("{0}, {1}", collapseTooltip, collapsed ? lf("Collapsed") : "Expanded")} onButtonClick={this.toggleCollapse} view='tablet' />
                                    </div>
                                </div> : undefined}
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="five wide column">
                            <div className="ui grid right aligned">
                                {compileBtn ? <div className="row">
                                    <div className="column">
                                        <EditorToolbarButton role="menuitem" className={`primary large fluid download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='tablet' />
                                    </div>
                                </div> : undefined}
                                {showProjectRename ?
                                    <div className="row" style={compileBtn ? { paddingTop: 0 } : {}}>
                                        <div className="column">
                                            <div className={`ui item large right ${showSave ? "labeled" : ""} fluid input projectname-input projectname-tablet`} title={lf("Pick a name for your project")}>
                                                <label htmlFor="fileNameInput1" id="fileNameInputLabel1" className="accessible-hidden">{lf("Type a name for your project")}</label>
                                                <EditorToolbarSaveInput id="fileNameInput1"
                                                    type="text"
                                                    aria-labelledby="fileNameInputLabel1"
                                                    placeholder={lf("Pick a name...")}
                                                    value={projectName || ''}
                                                    onChangeValue={this.saveProjectName} view='tablet' />
                                                {showSave ? <EditorToolbarButton icon='save' className={`large right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='tablet' /> : undefined}
                                            </div>
                                        </div>
                                    </div> : undefined}
                            </div>
                        </div>
                        <div className="six wide column right aligned">
                            <div className="ui grid right aligned">
                                {showUndoRedo || showZoomControls ?
                                    <div className="row">
                                        <div className="column">
                                            {showUndoRedo ?
                                                <div className="ui icon large buttons">
                                                    <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo")} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} onButtonClick={this.undo} view='tablet' />
                                                    <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo")} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} onButtonClick={this.redo} view='tablet' />
                                                </div> : undefined}
                                            {showZoomControls ?
                                                <div className="ui icon large buttons">
                                                    <EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view='tablet' />
                                                    <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view='tablet' />
                                                </div> : undefined}
                                        </div>
                                    </div> : undefined}
                                <div className="row" style={showUndoRedo || showZoomControls ? { paddingTop: 0 } : {}}>
                                    <div className="column">
                                        {trace ? <EditorToolbarButton key='tracebtn' className={`large trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='tablet' /> : undefined}
                                        {debug ? <EditorToolbarButton key='debugbtn' className={`large debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='tablet' /> : undefined}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>}
            </div>
            <div className="column computer only">
                <div className="ui grid equal width">
                    <div id="downloadArea" className="ui column items">{headless ?
                        <div className="ui item">
                            <div className="ui icon large buttons">
                                {showCollapsed ? <EditorToolbarButton icon={`${collapseEditorTools ? 'toggle ' + (isRtl ? 'left' : 'right') : 'toggle ' + (isRtl ? 'right' : 'left')}`} className={`large collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='computer' /> : undefined}
                                {run ? <EditorToolbarButton role="menuitem" className={`large play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='computer' /> : undefined}
                                {restart ? <EditorToolbarButton key='restartbtn' className={`large restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='computer' /> : undefined}
                                {trace ? <EditorToolbarButton key='tracebtn' className={`large trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='computer' /> : undefined}
                                {debug ? <EditorToolbarButton key='debugbtn' className={`large debug-button ${debugging ? 'orange' : ''}`} icon="xicon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='computer' /> : undefined}
                                {compileBtn ? <EditorToolbarButton icon={downloadIcon} className={`primary large download-button ${downloadButtonClasses}`} title={compileTooltip} onButtonClick={this.compile} view='computer' /> : undefined}
                            </div>
                        </div> :
                        <div className="ui item">
                            {showCollapsed && !pairingButton ? <EditorToolbarButton icon={`toggle ${collapseEditorTools ? (isRtl ? 'left' : 'right') : (isRtl ? 'right' : 'left')}`} className={`large collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='computer' /> : undefined}
                            {compileBtn ? <EditorToolbarButton icon={downloadIcon} className={`primary huge fluid download-button ${downloadButtonClasses}`} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='computer' /> : undefined}
                        </div>
                    }
                    </div>
                    {showProjectRename ?
                        <div className="column left aligned">
                            <div className={`ui right ${showSave ? "labeled" : ""} input projectname-input projectname-computer`} title={lf("Pick a name for your project")}>
                                <label htmlFor="fileNameInput2" id="fileNameInputLabel2" className="accessible-hidden">{lf("Type a name for your project")}</label>
                                <EditorToolbarSaveInput id="fileNameInput2" view='computer'
                                    type="text"
                                    aria-labelledby="fileNameInputLabel2"
                                    placeholder={lf("Pick a name...")}
                                    value={projectName || ''}
                                    onChangeValue={this.saveProjectName} />
                                {showSave ? <EditorToolbarButton icon='save' className={`small right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='computer' /> : undefined}
                            </div>
                        </div> : undefined}
                    <div className="column right aligned">
                        {showUndoRedo ?
                            <div className="ui icon small buttons">
                                <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='computer' />
                                <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} title={lf("Redo")} onButtonClick={this.redo} view='computer' />
                            </div> : undefined}
                        {showZoomControls ?
                            <div className="ui icon small buttons">
                                <EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view='computer' />
                                <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view='computer' />
                            </div> : undefined}
                        {targetTheme.bigRunButton ?
                            <div className="big-play-button-wrapper">
                                <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='computer' />
                            </div> : undefined}
                    </div>
                </div>
            </div>
        </div>;
    }
}

interface EditorToolbarButtonProps extends sui.ButtonProps {
    view: string;
    onButtonClick: (view: string) => void;
}

class EditorToolbarButton extends sui.StatelessUIElement<EditorToolbarButtonProps> {
    constructor(props: EditorToolbarButtonProps) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { onButtonClick, view } = this.props;
        onButtonClick(view);
    }

    renderCore() {
        const { onClick, onButtonClick, ...rest } = this.props;
        return <sui.Button {...rest} onClick={this.handleClick} />;
    }
}

interface EditorToolbarSaveInputProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    view: string;
    onChangeValue: (value: string, view: string) => void;
}

class EditorToolbarSaveInput extends sui.StatelessUIElement<EditorToolbarSaveInputProps> {

    constructor(props: EditorToolbarSaveInputProps) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { onChangeValue, view } = this.props;
        onChangeValue((e.target as any).value, view);
    }

    renderCore() {
        const { onChange, onChangeValue, view, ...rest } = this.props;
        return <input onChange={this.handleChange} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} {...rest} />
    }
}
