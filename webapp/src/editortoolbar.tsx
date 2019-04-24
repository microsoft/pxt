/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

const enum View {
    Computer,
    Tablet,
    Mobile,
}

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

    private getViewString(view: View): string {
        return view.toString().toLowerCase();
    }

    private getCollapsedState(): string {
        return '' + this.props.parent.state.collapseEditorTools;
    }

    private getHeadlessState(): string {
        return pxt.appTarget.simulator.headless ? "true" : "false";
    }

    private getCollapseButton(view: View, collapsed: boolean, hideEditorFloats: boolean): JSX.Element {
        const isRtl = pxt.Util.isUserLanguageRtl();
        const collapseTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        switch (view) {
            case View.Computer:
                return ( <EditorToolbarButton icon={`${this.props.parent.state.collapseEditorTools ? 'toggle ' + (isRtl ? 'left' : 'right') : 'toggle ' + (isRtl ? 'right' : 'left')}`} className={`large collapse-button ${collapsed ? 'collapsed' : ''}`} title={collapseTooltip} onButtonClick={this.toggleCollapse} view='computer' />)
            default:
                return (<EditorToolbarButton icon={`${collapsed ? 'toggle up' : 'toggle down'}`} className={`collapse-button ${collapsed ? 'collapsed' : ''} ${hideEditorFloats ? 'disabled' : ''}`} title={collapseTooltip} ariaLabel={lf("{0}, {1}", collapseTooltip, hideEditorFloats ? lf("Disabled") : "")} onButtonClick={this.toggleCollapse} view={this.getViewString(view)}  />);

        }
    }

    private getUndoRedo(view: View): JSX.Element[] {
        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();
        return [<EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo")} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} onButtonClick={this.undo} view={this.getViewString(view)} key="undo" />,
                <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo")} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} onButtonClick={this.redo} view={this.getViewString(view)} key="redo" />]
    }

    private getZoomControl(view: View): JSX.Element[] {
        return [<EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view={this.getViewString(view)} key="minus" />,
                <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view={this.getViewString(view)} key="plus" />]
    }

    private getSaveInput(view: View, showSave: boolean, id?: string, projectName?: string): JSX.Element[] {
        let saveButtonClasses = "";
        if (this.props.parent.state.isSaving) {
            saveButtonClasses = "loading disabled";
        } else if (!!this.props.parent.state.compiling) {
            saveButtonClasses = "disabled";
        }

        let saveInput = [];
        if (view != View.Mobile) {
            saveInput.push(<label htmlFor={id} id={id} className="accessible-hidden" key="label">{lf("Type a name for your project")}</label>);
            saveInput.push(<EditorToolbarSaveInput id={id} view={this.getViewString(view)} key="input"
                            type="text"
                            aria-labelledby={id}
                            placeholder={lf("Pick a name...")}
                            value={projectName || ''}
                            onChangeValue={this.saveProjectName} />)
        }

        if (showSave) {
            saveInput.push(<EditorToolbarButton icon='save' className={`${view == View.Computer ? 'small' : 'large'} right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view={this.getViewString(view)} key="save" />)
        }

        return saveInput;
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
        const pairingButton = !!targetTheme.pairingButton;

        const hasUndo = this.props.parent.editor.hasUndo();

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

        const mobile = View.Mobile;
        const tablet = View.Tablet;
        const computer = View.Computer;

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
                                {showCollapsed && this.getCollapseButton(View.Mobile, collapsed, hideEditorFloats)}
                                {headless && run ? <EditorToolbarButton className={`play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='mobile' /> : undefined}
                                {headless && restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='mobile' /> : undefined}
                                {headless && trace ? <EditorToolbarButton key='tracebtn' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='mobile' /> : undefined}
                                {headless && debug ? <EditorToolbarButton key='debugbtn' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='mobile' /> : undefined}
                                {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} ariaLabel={lf("Download your code")} onButtonClick={this.compile} view='mobile' /> : undefined}
                            </div>
                        </div> : undefined}
                        <div id="editorToolbarArea" className={`column right aligned ${targetTheme.bigRunButton ? 'sixteen' : 'ten'} wide`}>
                            {!readOnly ?
                                <div className="ui icon small buttons">
                                    {this.getSaveInput(mobile, showSave)}
                                    {showUndoRedo ? <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='mobile' /> : undefined}
                                </div> : undefined}
                            {showZoomControls && <div className="ui icon small buttons">{this.getZoomControl(mobile)}</div>}
                            {targetTheme.bigRunButton ?
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='mobile' />
                                </div> : undefined}
                        </div>
                    </div> :
                    <div className="ui equal width grid">
                        <div className="left aligned two wide column">
                            {showCollapsed ?
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        {this.getCollapseButton(View.Mobile, collapsed, hideEditorFloats)}
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
                                    {showCollapsed && this.getCollapseButton(View.Tablet, collapsed, hideEditorFloats)}
                                    {run ? <EditorToolbarButton role="menuitem" className={`play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='tablet' /> : undefined}
                                    {restart ? <EditorToolbarButton key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='tablet' /> : undefined}
                                    {trace ? <EditorToolbarButton key='tracebtn' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='tablet' /> : undefined}
                                    {debug ? <EditorToolbarButton key='debug' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='tablet' /> : undefined}
                                    {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} title={compileTooltip} onButtonClick={this.compile} view='tablet' /> : undefined}
                                </div>
                            </div> :
                            <div className="left aligned six wide column">
                                <div className="ui icon buttons">
                                    {showCollapsed && this.getCollapseButton(View.Tablet, collapsed, hideEditorFloats)}
                                    {compileBtn ? <EditorToolbarButton className={`primary download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='tablet' /> : undefined}
                                </div>
                            </div>}
                        {showSave ? <div className="column four wide">
                            <EditorToolbarButton icon='save' className={`small editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='tablet' />
                        </div> : undefined}
                        <div className={`column ${showSave ? 'six' : 'ten'} wide right aligned`}>
                            {showUndoRedo && <div className="ui icon small buttons">{this.getUndoRedo(tablet)}</div>}
                            {showZoomControls && <div className="ui icon small buttons">{this.getZoomControl(tablet)}</div>}
                            {targetTheme.bigRunButton ?
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='tablet' />
                                </div> : undefined}
                        </div>
                    </div>
                    : <div className="ui grid">
                        <div className="left aligned two wide column">
                            {showCollapsed &&
                                <div className="row" style={{ paddingTop: "1rem" }}>
                                    <div className="ui vertical icon small buttons">
                                        {this.getCollapseButton(View.Tablet, collapsed, hideEditorFloats)}
                                    </div>
                                </div>}
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="five wide column">
                            <div className="ui grid right aligned">
                                {compileBtn && <div className="row">
                                    <div className="column">
                                        <EditorToolbarButton role="menuitem" className={`primary large fluid download-button download-button-full ${downloadButtonClasses}`} icon={downloadIcon} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='tablet' />
                                    </div>
                                </div>}
                                {showProjectRename &&
                                    <div className="row" style={compileBtn ? { paddingTop: 0 } : {}}>
                                        <div className="column">
                                            <div className={`ui item large right ${showSave ? "labeled" : ""} fluid input projectname-input projectname-tablet`} title={lf("Pick a name for your project")}>
                                                {this.getSaveInput(tablet, showSave, "fileNameInput1", projectName)}
                                            </div>
                                        </div>
                                    </div>}
                            </div>
                        </div>
                        <div id="editor" className="six wide column right aligned">
                            <div className="ui grid right aligned">
                                {showUndoRedo || showZoomControls ?
                                    <div className="row">
                                        <div className="column">
                                            {showUndoRedo && <div className="ui icon large buttons">{this.getUndoRedo(tablet)}</div>}
                                            {showZoomControls && <div className="ui icon large buttons">{this.getZoomControl(tablet)}</div>}
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
                                {showCollapsed && this.getCollapseButton(View.Computer, collapsed, hideEditorFloats)}
                                {run ? <EditorToolbarButton role="menuitem" className={`large play-button ${running || debugging ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={runTooltip} onButtonClick={this.startStopSimulator} view='computer' /> : undefined}
                                {restart ? <EditorToolbarButton key='restartbtn' className={`large restart-button`} icon="refresh" title={restartTooltip} onButtonClick={this.restartSimulator} view='computer' /> : undefined}
                                {trace ? <EditorToolbarButton key='tracebtn' className={`large trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onButtonClick={this.toggleTrace} view='computer' /> : undefined}
                                {debug ? <EditorToolbarButton key='debugbtn' className={`large debug-button ${debugging ? 'orange' : ''}`} icon="xicon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='computer' /> : undefined}
                                {compileBtn ? <EditorToolbarButton icon={downloadIcon} className={`primary large download-button ${downloadButtonClasses}`} title={compileTooltip} onButtonClick={this.compile} view='computer' /> : undefined}
                            </div>
                        </div> :
                        <div className="ui item">
                            {showCollapsed && !pairingButton && this.getCollapseButton(View.Computer, collapsed, hideEditorFloats)}
                            {compileBtn ? <EditorToolbarButton icon={downloadIcon} className={`primary huge fluid download-button ${downloadButtonClasses}`} text={downloadText} title={compileTooltip} onButtonClick={this.compile} view='computer' /> : undefined}
                        </div>
                    }
                    </div>
                    {showProjectRename &&
                        <div id="projectNameArea" className="column left aligned">
                            <div className={`ui right ${showSave ? "labeled" : ""} input projectname-input projectname-computer`} title={lf("Pick a name for your project")}>
                                {this.getSaveInput(computer, showSave, "fileNameInput2", projectName)}
                            </div>
                        </div>}
                    <div id="editorToolbarArea" className="column right aligned">
                        {showUndoRedo && <div className="ui icon small buttons">{this.getUndoRedo(computer)}</div>}
                        {showZoomControls && <div className="ui icon small buttons">{this.getZoomControl(computer)}</div>}
                        {targetTheme.bigRunButton &&
                            <div className="big-play-button-wrapper">
                                <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='computer' />
                            </div>}
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
