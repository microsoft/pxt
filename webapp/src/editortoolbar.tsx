/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";

type ISettingsProps = pxt.editor.ISettingsProps;

export class EditorToolbar extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    saveProjectName(name: string, view?: string) {
        pxt.tickEvent("editortools.projectrename", { view: view });
        this.props.parent.updateHeaderName(name);
    }

    compile(view?: string) {
        pxt.tickEvent("editortools.download", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.compile();
    }

    saveFile(view?: string) {
        pxt.tickEvent("editortools.save", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.saveAndCompile();
    }

    undo(view?: string) {
        pxt.tickEvent("editortools.undo", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.undo();
    }

    redo(view?: string) {
        pxt.tickEvent("editortools.redo", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.redo();
    }

    zoomIn(view?: string) {
        pxt.tickEvent("editortools.zoomIn", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.zoomIn();
    }

    zoomOut(view?: string) {
        pxt.tickEvent("editortools.zoomOut", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.zoomOut();
    }

    startStopSimulator(view?: string) {
        pxt.tickEvent("editortools.startStopSimulator", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() });
        this.props.parent.startStopSimulator();
    }

    restartSimulator(view?: string) {
        pxt.tickEvent("editortools.restart", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() });
        this.props.parent.restartSimulator();
    }

    toggleTrace(view?: string) {
        pxt.tickEvent("editortools.trace", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() });
        this.props.parent.toggleTrace();
    }

    toggleCollapse(view?: string) {
        pxt.tickEvent("editortools.toggleCollapse", { view: view, collapsedTo: '' + !this.props.parent.state.collapseEditorTools });
        this.props.parent.toggleSimulatorCollapse();
    }

    private getCollapsedState(): string {
        return '' + this.props.parent.state.collapseEditorTools;
    }

    private getHeadlessState(): string {
        return pxt.appTarget.simulator.headless ? "true" : "false";
    }

    render() {
        const { tutorialOptions, hideEditorFloats, collapseEditorTools, projectName, showParts, compiling, isSaving, running } = this.props.parent.state;

        const sandbox = pxt.shell.isSandboxMode();
        const readOnly = pxt.shell.isReadOnly();
        const tutorial = tutorialOptions ? tutorialOptions.tutorial : false;
        const collapsed = (hideEditorFloats || collapseEditorTools) && !tutorial;
        const isEditor = this.props.parent.isBlocksEditor() || this.props.parent.isTextEditor();
        if (!isEditor) return <div />;

        const targetTheme = pxt.appTarget.appTheme;
        const compile = pxt.appTarget.compile;
        const compileBtn = compile.hasHex;
        const simOpts = pxt.appTarget.simulator;
        const make = !sandbox && showParts && simOpts && (simOpts.instructions || (simOpts.parts && pxt.options.debug));
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const compileLoading = !!compiling;
        const runTooltip = running ? lf("Stop the simulator") : lf("Start the simulator");
        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const collapseTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        const headless = simOpts.headless;

        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();

        const showCollapsed = !tutorial;
        const showProjectRename = !tutorial && !readOnly;
        const showUndoRedo = !tutorial && !readOnly;
        const showZoomControls = !tutorial;

        const run = true;
        const restart = run && !simOpts.hideRestart;
        const trace = run && simOpts.enableTrace;
        const tracing = this.props.parent.state.tracing;
        const traceTooltip = tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo");
        const downloadIcon = pxt.appTarget.appTheme.downloadIcon || "download";
        const downloadText = pxt.appTarget.appTheme.useUploadMessage ? lf("Upload") : lf("Download");

        let downloadButtonClasses = "";
        let saveButtonClasses = "";
        if (isSaving) {
            downloadButtonClasses = "disabled";
            saveButtonClasses = "loading disabled";
        } else if (compileLoading) {
            downloadButtonClasses = "loading disabled";
            saveButtonClasses = "disabled";
        }

        return <div className="ui equal width grid right aligned padded">
            <div className="column mobile only">
                {collapsed ?
                    <div className="ui equal width grid">
                        <div className="left aligned column">
                            <div className="ui icon small buttons">
                                <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onClick={() => this.toggleCollapse('mobile') } />
                                {headless && run ? <sui.Button class={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' icon={running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('mobile') } /> : undefined }
                                {headless && restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('mobile') } /> : undefined }
                                {headless && trace ? <sui.Button key='tracebtn' class={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace('mobile') } /> : undefined }
                                {compileBtn ? <sui.Button class={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} ariaLabel={lf("Download your code")} onClick={() => this.compile('mobile') } /> : undefined }
                            </div>
                        </div>
                        <div className="right aligned column">
                            {!readOnly ?
                                <div className="ui icon small buttons">
                                    <sui.Button icon='save' class={`editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onClick={() => this.saveFile('mobile') } />
                                    {showUndoRedo ? <sui.Button icon='xicon undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo") } onClick={() => this.undo('mobile') } /> : undefined }
                                </div> : undefined }
                        </div>
                        <div className="right aligned column">
                            {showZoomControls ?
                                <div className="ui icon small buttons">
                                    <sui.Button icon='plus circle' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('mobile') } />
                                    <sui.Button icon='minus circle' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('mobile') } />
                                </div> : undefined }
                        </div>
                    </div> :
                    <div className="ui equal width grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <sui.Button class={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' icon={running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('mobile') } /> : undefined }
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('mobile') } /> : undefined }
                            </div>
                            {showCollapsed ?
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} ariaLabel={lf("{0}, {1}", collapseTooltip, collapsed ? lf("Collapsed") : "Expanded")} onClick={() => this.toggleCollapse('mobile') } />
                                    </div>
                                </div> : undefined }
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="ui grid column">
                            {readOnly || !showUndoRedo ? undefined :
                                <div className="row">
                                    <div className="column">
                                        <div className="ui icon large buttons">
                                            <sui.Button icon='xicon undo' class={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo") } onClick={() => this.undo('mobile') } />
                                        </div>
                                    </div>
                                </div>}
                            <div className="row" style={readOnly || !showUndoRedo ? undefined : { paddingTop: 0 }}>
                                <div className="column">
                                    <div className="ui icon large buttons">
                                        {trace ? <sui.Button key='tracebtn' class={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace('mobile') } /> : undefined }
                                        {compileBtn ? <sui.Button class={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} onClick={() => this.compile('mobile') } /> : undefined }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div> }
            </div>
            <div className="column tablet only">
                {collapsed ?
                    <div className="ui grid seven column">
                        {headless ?
                            <div className="left aligned six wide column">
                                <div className="ui icon buttons">
                                    <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onClick={() => this.toggleCollapse('tablet') } />
                                    {run ? <sui.Button role="menuitem" class={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' icon={running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('tablet') } /> : undefined }
                                    {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('tablet') } /> : undefined }
                                    {trace ? <sui.Button key='tracebtn' class={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace('tablet') } /> : undefined }
                                    {compileBtn ? <sui.Button class={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} onClick={() => this.compile('tablet') } /> : undefined }
                                </div>
                            </div> :
                            <div className="left aligned six wide column">
                                <div className="ui icon buttons">
                                    <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} title={collapseTooltip} onClick={() => this.toggleCollapse('tablet') } />
                                    {compileBtn ? <sui.Button class={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onClick={() => this.compile('tablet') } /> : undefined }
                                </div>
                            </div> }
                        <div className="column four wide">
                            {readOnly ? undefined :
                                <sui.Button icon='save' class={`small editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onClick={() => this.saveFile('tablet') } /> }
                        </div>
                        <div className="column six wide right aligned">
                            {showUndoRedo ?
                                <div className="ui icon small buttons">
                                    <sui.Button icon='xicon undo' class={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo") } onClick={() => this.undo('tablet') } />
                                    <sui.Button icon='xicon redo' class={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Red"), !hasRedo ? lf("Disabled") : "")} title={lf("Redo") } onClick={() => this.redo('tablet') } />
                                </div> : undefined }
                            {showZoomControls ?
                                <div className="ui icon small buttons">
                                    <sui.Button icon='plus circle' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('tablet') } />
                                    <sui.Button icon='minus circle' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('tablet') } />
                                </div> : undefined }
                        </div>
                    </div>
                    : <div className="ui grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <sui.Button role="menuitem" class={`play-button ${running ? "stop" : "play"}`} key='runmenubtn' icon={running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('tablet') } /> : undefined }
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('tablet') } /> : undefined }
                            </div>
                            {showCollapsed ?
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} ariaLabel={lf("{0}, {1}", collapseTooltip, collapsed ? lf("Collapsed") : "Expanded")} onClick={() => this.toggleCollapse('tablet') } />
                                    </div>
                                </div> : undefined }
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="five wide column">
                            <div className="ui grid right aligned">
                                {compileBtn ? <div className="row">
                                    <div className="column">
                                        <sui.Button role="menuitem" class={`primary large fluid download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onClick={() => this.compile('tablet') } />
                                    </div>
                                </div> : undefined }
                                {showProjectRename ?
                                    <div className="row" style={compileBtn ? { paddingTop: 0 } : {}}>
                                        <div className="column">
                                            <div className="ui item large right labeled fluid input projectname-input projectname-tablet" title={lf("Pick a name for your project") }>
                                                <label htmlFor="fileNameInput1" id="fileNameInputLabel1" className="accessible-hidden">{lf("Type a name for your project")}</label>
                                                <input id="fileNameInput1"
                                                    type="text"
                                                    aria-labelledby="fileNameInputLabel1"
                                                    placeholder={lf("Pick a name...") }
                                                    value={projectName || ''}
                                                    onChange={(e) => this.saveProjectName((e.target as any).value, 'tablet') }>
                                                </input>
                                                <sui.Button icon='save' class={`large right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onClick={() => this.saveFile('tablet') } />
                                            </div>
                                        </div>
                                    </div> : undefined }
                            </div>
                        </div>
                        <div className="six wide column right aligned">
                            <div className="ui grid right aligned">
                                { showUndoRedo || showZoomControls ?
                                    <div className="row">
                                        <div className="column">
                                            {showUndoRedo ?
                                                <div className="ui icon large buttons">
                                                    <sui.Button icon='xicon undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo")} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} onClick={() => this.undo() } />
                                                    <sui.Button icon='xicon redo' class={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo")} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} onClick={() => this.redo() } />
                                                </div> : undefined }
                                            {showZoomControls ?
                                                <div className="ui icon large buttons">
                                                    <sui.Button icon='plus circle' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn() } />
                                                    <sui.Button icon='minus circle' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut() } />
                                                </div> : undefined }
                                        </div>
                                    </div> : undefined }
                                {trace ?
                                    <div className="row" style={showUndoRedo || showZoomControls ? { paddingTop: 0 } : {}}>
                                        <div className="column">
                                            <sui.Button key='tracebtn' class={`large trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace('tablet') } />
                                        </div>
                                    </div> : undefined }
                            </div>
                        </div>
                    </div> }
            </div>
            <div className="column computer only">
                <div className="ui grid equal width">
                    <div id="downloadArea" className="ui column items">{headless ?
                        <div className="ui item">
                            <div className="ui icon large buttons">
                                {showCollapsed ? <sui.Button icon={`${collapseEditorTools ? 'toggle right' : 'toggle left'}`} class={`large collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} onClick={() => this.toggleCollapse('computer') } /> : undefined }
                                {run ? <sui.Button role="menuitem" class={`large play-button ${running ? "stop" : "play"}`} key='runmenubtn' icon={running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('computer') } /> : undefined }
                                {restart ? <sui.Button key='restartbtn' class={`large restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('computer') } /> : undefined }
                                {trace ? <sui.Button key='tracebtn' class={`large trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace('computer') } /> : undefined }
                                {compileBtn ? <sui.Button icon={downloadIcon} class={`primary large download-button ${downloadButtonClasses}`} title={compileTooltip} onClick={() => this.compile('computer') } /> : undefined }
                            </div>
                        </div> :
                        <div className="ui item">
                            {showCollapsed ? <sui.Button icon={`${collapseEditorTools ? 'toggle right' : 'toggle left'}`} class={`large collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} onClick={() => this.toggleCollapse('computer') } /> : undefined }
                            {compileBtn ? <sui.Button icon={downloadIcon} class={`primary huge fluid download-button ${downloadButtonClasses}`} text={downloadText} title={compileTooltip} onClick={() => this.compile('computer') } /> : undefined }
                        </div>
                    }
                    </div>
                    {showProjectRename ?
                        <div className="column left aligned">
                            <div className={`ui right labeled input projectname-input projectname-computer`} title={lf("Pick a name for your project") }>
                                <label htmlFor="fileNameInput2" id="fileNameInputLabel2" className="accessible-hidden">{lf("Type a name for your project")}</label>
                                <input id="fileNameInput2"
                                    type="text"
                                    aria-labelledby="fileNameInputLabel2"
                                    placeholder={lf("Pick a name...") }
                                    value={projectName || ''}
                                    onChange={(e) => this.saveProjectName((e.target as any).value, 'computer') }>
                                </input>
                                <sui.Button icon='save' class={`small right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onClick={() => this.saveFile('computer') } />
                            </div>
                        </div> : undefined }
                    <div className="column right aligned">
                        {showUndoRedo ?
                            <div className="ui icon small buttons">
                                <sui.Button icon='xicon undo' class={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo") } onClick={() => this.undo('computer') } />
                                <sui.Button icon='xicon redo' class={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} title={lf("Redo") } onClick={() => this.redo('computer') } />
                            </div> : undefined }
                        {showZoomControls ?
                            <div className="ui icon small buttons">
                                <sui.Button icon='plus circle' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('computer') } />
                                <sui.Button icon='minus circle' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('computer') } />
                            </div> : undefined }
                    </div>
                </div>
            </div>
        </div>;
    }
}