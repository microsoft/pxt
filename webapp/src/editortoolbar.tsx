/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as githubbutton from "./githubbutton";
import * as cmds from "./cmds"

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
        this.toggleDebugging = this.toggleDebugging.bind(this);
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
        this.props.parent.forceUpdate();
    }

    zoomOut(view?: string) {
        pxt.tickEvent("editortools.zoomOut", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.zoomOut();
        this.props.parent.forceUpdate();
    }

    startStopSimulator(view?: string) {
        pxt.tickEvent("editortools.startStopSimulator", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.startStopSimulator({ clickTrigger: true });
    }

    toggleDebugging(view?: string) {
        pxt.tickEvent("editortools.debug", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
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

    private getUndoRedo(view: View): JSX.Element[] {
        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();
        return [<EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo")} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} onButtonClick={this.undo} view={this.getViewString(view)} key="undo" />,
        <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo")} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} onButtonClick={this.redo} view={this.getViewString(view)} key="redo" />]
    }

    private getZoomControl(view: View): JSX.Element[] {
        return [<EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view={this.getViewString(view)} key="minus" />,
        <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view={this.getViewString(view)} key="plus" />]
    }

    private getSaveInput(view: View, showSave: boolean, id?: string, projectName?: string, projectNameReadOnly?: boolean): JSX.Element[] {
        let saveButtonClasses = "";
        if (this.props.parent.state.isSaving) {
            saveButtonClasses = "loading disabled";
        } else if (!!this.props.parent.state.compiling) {
            saveButtonClasses = "disabled";
        }

        let saveInput = [];
        if (view != View.Mobile) {
            saveInput.push(<label htmlFor={id} className="accessible-hidden" key="label">{lf("Type a name for your project")}</label>);
            saveInput.push(<EditorToolbarSaveInput id={id} view={this.getViewString(view)} key="input"
                type="text"
                aria-labelledby={id}
                placeholder={lf("Pick a name...")}
                value={projectName || ''}
                onChangeValue={this.saveProjectName}
                disabled={projectNameReadOnly}
                readOnly={projectNameReadOnly}
            />)
        }

        if (showSave) {
            const sizeClass = view == View.Computer ? 'small' : 'large';
            saveInput.push(<EditorToolbarButton icon='save' className={`${sizeClass} right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view={this.getViewString(view)} key={`save${view}`} />)
        }

        return saveInput;
    }

    protected onHwItemClick = () => {
        if (pxt.hasHwVariants())
            this.props.parent.showChooseHwDialog(true);
        else
            this.props.parent.showBoardDialogAsync(undefined, true).done();

    }

    protected onHwDownloadClick = () => {
        this.compile();
    }

    protected onPairClick = () => {
        pxt.tickEvent("editortools.pair", undefined, { interactiveConsent: true });
        this.props.parent.pairAsync();
    }

    protected onDisconnectClick = () => {
        cmds.showDisconnectAsync().done();
    }

    protected getCompileButton(view: View, collapsed?: boolean): JSX.Element[] {
        const targetTheme = pxt.appTarget.appTheme;
        const { compiling, isSaving } = this.props.parent.state;
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const downloadText = targetTheme.useUploadMessage ? lf("Upload") : lf("Download");
        const boards = pxt.appTarget.simulator && !!pxt.appTarget.simulator.dynamicBoardDefinition;
        const webUSBSupported = pxt.usb.isEnabled && pxt.appTarget?.compile?.webUSB;
        const packetioConnected = !!this.getData("packetio:connected");
        const packetioConnecting = !!this.getData("packetio:connecting");
        const packetioIcon = this.getData("packetio:icon") as string;
        const downloadIcon = (!!packetioConnecting && "ping " + packetioIcon)
            || (!!packetioConnected && "ping2s " + packetioIcon)
            || targetTheme.downloadIcon || "download";
        const hasMenu = boards || webUSBSupported;

        let downloadButtonClasses = hasMenu ? "left attached " : "";
        const downloadButtonIcon = "ellipsis";
        let hwIconClasses = "";
        let displayRight = false;
        if (isSaving) {
            downloadButtonClasses += "disabled ";
        } else if (compiling) {
            downloadButtonClasses += "loading disabled ";
        }
        if (packetioConnected)
            downloadButtonClasses += "connected ";
        else if (packetioConnecting)
            downloadButtonClasses += "connecting ";
        switch (view) {
            case View.Mobile:
                downloadButtonClasses += "download-button-full";
                displayRight = collapsed;
                break;
            case View.Tablet:
                downloadButtonClasses += `download-button-full ${!collapsed ? 'large fluid' : ''}`;
                hwIconClasses = !collapsed ? "large" : "";
                displayRight = collapsed;
                break;
            case View.Computer:
            default:
                downloadButtonClasses += "huge fluid";
                hwIconClasses = "large";
        }

        let el = [];
        el.push(<EditorToolbarButton key="downloadbutton" role="menuitem" icon={downloadIcon} className={`primary download-button ${downloadButtonClasses}`} text={view != View.Mobile ? downloadText : undefined} title={compileTooltip} onButtonClick={this.compile} view='computer' />)

        const deviceName = pxt.hwName || pxt.appTarget.appTheme.boardNickname || lf("device");
        const tooltip = pxt.hwName
            || (packetioConnected && lf("Connected to {0}", deviceName))
            || (packetioConnecting && lf("Connecting..."))
            || (boards ? lf("Click to select hardware") : lf("Click for one-click downloads."));

        const hardwareMenuText = view == View.Mobile ? lf("Hardware") : lf("Choose hardware");
        const downloadMenuText = view == View.Mobile ? (pxt.hwName || lf("Download")) : lf("Download to {0}", deviceName);

        if (hasMenu) {
            el.push(
                <sui.DropdownMenu key="downloadmenu" role="menuitem" icon={`${downloadButtonIcon} horizontal ${hwIconClasses}`} title={lf("Download options")} className={`${hwIconClasses} right attached editortools-btn hw-button button`} dataTooltip={tooltip} displayAbove={true} displayRight={displayRight}>
                    {webUSBSupported && !packetioConnected && <sui.Item role="menuitem" icon="usb" text={lf("Pair device")} tabIndex={-1} onClick={this.onPairClick} />}
                    {webUSBSupported && (packetioConnecting || packetioConnected) && <sui.Item role="menuitem" icon="usb" text={lf("Disconnect")} tabIndex={-1} onClick={this.onDisconnectClick} />}
                    {boards && <sui.Item role="menuitem" icon="microchip" text={hardwareMenuText} tabIndex={-1} onClick={this.onHwItemClick} />}
                    <sui.Item role="menuitem" icon="download" text={downloadMenuText} tabIndex={-1} onClick={this.onHwDownloadClick} />
                </sui.DropdownMenu>
            )
        }
        return el;
    }

    renderCore() {
        const { home, tutorialOptions, hideEditorFloats, collapseEditorTools, projectName, compiling, isSaving, simState, debugging, header } = this.props.parent.state;

        if (home) return <div />; // Don't render if we're in the home screen

        const targetTheme = pxt.appTarget.appTheme;
        const isController = pxt.shell.isControllerMode();
        const readOnly = pxt.shell.isReadOnly();
        const tutorial = tutorialOptions ? tutorialOptions.tutorial : false;
        const hideIteration = tutorialOptions && tutorialOptions.metadata && tutorialOptions.metadata.hideIteration;
        const simOpts = pxt.appTarget.simulator;
        const headless = simOpts.headless;
        const collapsed = (hideEditorFloats && headless) || collapseEditorTools;
        const isEditor = this.props.parent.isBlocksEditor() || this.props.parent.isTextEditor();
        if (!isEditor) return <div />;

        const disableFileAccessinMaciOs = targetTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac());
        const ghid = header && pxt.github.parseRepoId(header.githubId);
        const hasRepository = !!ghid;
        const showSave = !readOnly && !isController && !targetTheme.saveInMenu
            && !tutorial && !debugging && !disableFileAccessinMaciOs
            && !hasRepository;
        const showProjectRename = !tutorial && !readOnly && !isController
            && !targetTheme.hideProjectRename && !debugging;
        const showProjectRenameReadonly = hasRepository && /^pxt-/.test(ghid.project); // allow renaming of name with github
        const compile = pxt.appTarget.compile;
        const compileBtn = compile.hasHex || compile.saveAsPNG || compile.useUF2;
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const compileLoading = !!compiling;
        const running = simState == pxt.editor.SimState.Running;
        const starting = simState == pxt.editor.SimState.Starting;

        const hasUndo = this.props.parent.editor.hasUndo();

        const showUndoRedo = !readOnly && !debugging;
        const showZoomControls = true;
        const showGithub = !!pxt.appTarget.cloud
            && !!pxt.appTarget.cloud.githubPackages
            && !!targetTheme.githubEditor
            && !readOnly && !isController && !debugging && !tutorial;

        const debug = !!targetTheme.debugger && !readOnly;
        const debugTooltip = debugging ? lf("Disable Debugging") : lf("Debugging")
        const downloadIcon = pxt.appTarget.appTheme.downloadIcon || "download";

        const bigRunButtonTooltip = (() => {
            switch (simState) {
                case pxt.editor.SimState.Stopped:
                    return lf("Start");
                case pxt.editor.SimState.Pending:
                case pxt.editor.SimState.Starting:
                    return lf("Starting");
                default:
                    return lf("Stop");
            }
        })();

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

        return <div className="ui equal width grid right aligned padded">
            <div className="column mobile only">
                {collapsed ?
                    <div className="ui grid">
                        {!targetTheme.bigRunButton && <div className="left aligned column four wide">
                            <div className="ui icon small buttons">
                                {compileBtn && this.getCompileButton(mobile, true)}
                            </div>
                        </div>}
                        <div id="editorToolbarArea" className={`column right aligned ${targetTheme.bigRunButton ? 'sixteen' : 'twelve'} wide`}>
                            {showSave &&
                                <div className="ui icon small buttons">
                                    {this.getSaveInput(mobile, showSave)}
                                </div>}
                            {showGithub &&
                                <div className="ui icon small buttons">
                                    <githubbutton.GithubButton parent={this.props.parent} key={`githubbtn${mobile}`} />
                                </div>}
                            {showUndoRedo &&
                                <div className="ui icon small buttons">
                                    <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} title={lf("Undo")} onButtonClick={this.undo} view='mobile' />
                                </div>}
                            {showZoomControls && <div className="ui icon small buttons">{this.getZoomControl(mobile)}</div>}
                            {targetTheme.bigRunButton &&
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='mobile' />
                                </div>}
                        </div>
                    </div> :
                    <div className="ui equal width grid">
                        <div className="left aligned five wide column">
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
                                            {debug && <EditorToolbarButton key='debugbtn' className={`debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='mobile' />}
                                            {compileBtn && this.getCompileButton(mobile)}
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
                        <div className="left aligned six wide column">
                            <div className="ui icon buttons">
                                {compileBtn && this.getCompileButton(tablet, true)}
                            </div>
                        </div>
                        {(showSave || showGithub) && <div className="column four wide">
                            {showSave && <EditorToolbarButton icon='save' className={`small editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view='tablet' />}
                            {showGithub && <githubbutton.GithubButton parent={this.props.parent} key={`githubbtntablet`} className={"small"} />}
                        </div>}
                        <div className={`column ${(showSave || showGithub) ? 'six' : 'ten'} wide right aligned`}>
                            {showUndoRedo && <div className="ui icon small buttons">{this.getUndoRedo(tablet)}</div>}
                            {showZoomControls && <div className="ui icon small buttons">{this.getZoomControl(tablet)}</div>}
                            {targetTheme.bigRunButton &&
                                <div className="big-play-button-wrapper">
                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='tablet' />
                                </div>}
                        </div>
                    </div>
                    : <div className="ui grid">
                        <div className="left aligned five wide column">
                        </div>
                        <div className="five wide column">
                            <div className="ui grid right aligned">
                                {compileBtn && <div className="ui row items" style={{ paddingBottom: 0, marginBottom: '1rem' }}>
                                    <div className="ui item">
                                        {this.getCompileButton(tablet)}
                                    </div>
                                </div>}
                                {(showProjectRename || showGithub) &&
                                    <div className="ui row items" style={compileBtn ? { paddingTop: 0, marginTop: 0 } : {}}>
                                        {(showProjectRename || showGithub) && <div className={`ui item large right ${showSave ? "labeled" : ""} fluid input projectname-input projectname-tablet`}>
                                            {showProjectRename && this.getSaveInput(tablet, showSave, "fileNameInput1", projectName, showProjectRenameReadonly)}
                                            {showGithub && <githubbutton.GithubButton parent={this.props.parent} key={`githubbtn${tablet}`} />}
                                        </div>}
                                    </div>}
                            </div>
                        </div>
                        <div id="editor" className="six wide column right aligned">
                            <div className="ui grid right aligned">
                                {(showUndoRedo || showZoomControls) &&
                                    <div className="row">
                                        <div className="column">
                                            {showUndoRedo && <div className="ui icon large buttons">{this.getUndoRedo(tablet)}</div>}
                                            {showZoomControls && <div className="ui icon large buttons">{this.getZoomControl(tablet)}</div>}
                                            {targetTheme.bigRunButton && !hideIteration &&
                                                <div className="big-play-button-wrapper">
                                                    <EditorToolbarButton role="menuitem" className={`big-play-button play-button ${running ? "stop" : "play"}`} key='runmenubtn' disabled={starting} icon={running ? "stop" : "play"} title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator} view='tablet' />
                                                </div>}
                                        </div>
                                    </div>}
                                <div className="row" style={showUndoRedo || showZoomControls ? { paddingTop: 0 } : {}}>
                                    <div className="column">
                                        {debug && <EditorToolbarButton key='debugbtn' className={`large debug-button ${debugging ? 'orange' : ''}`} icon="icon bug" title={debugTooltip} onButtonClick={this.toggleDebugging} view='tablet' />}
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
                                {compileBtn && <EditorToolbarButton icon={downloadIcon} className={`primary large download-button ${downloadButtonClasses}`} title={compileTooltip} onButtonClick={this.compile} view='computer' />}
                            </div>
                        </div> :
                        <div className="ui item">
                            {compileBtn && this.getCompileButton(computer)}
                        </div>
                    }
                    </div>
                    {(showProjectRename || showGithub) &&
                        <div id="projectNameArea" className="column left aligned">
                            <div className={`ui right ${showSave ? "labeled" : ""} input projectname-input projectname-computer`}>
                                {showProjectRename && this.getSaveInput(computer, showSave, "fileNameInput2", projectName, showProjectRenameReadonly)}
                                {showGithub && <githubbutton.GithubButton parent={this.props.parent} key={`githubbtn${computer}`} />}
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
