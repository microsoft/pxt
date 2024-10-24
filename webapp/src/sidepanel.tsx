/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as filelist from "./filelist";
import * as keymap from "./keymap";
import * as serialindicator from "./serialindicator"
import * as simtoolbar from "./simtoolbar";
import * as simulator from "./simulator";

import { Button } from "./sui";
import { SimulatorPresenceBar } from "./components/SimulatorPresenceBar"
import { TutorialContainer } from "./components/tutorial/TutorialContainer";
import { VerticalResizeContainer } from '../../react-common/components/controls/VerticalResizeContainer'

import ISettingsProps = pxt.editor.ISettingsProps;
import { classList } from "../../react-common/components/util";

interface SidepanelState {
    resized?: boolean;
    height?: number;
    lastResizeHeight?: number;
    shouldResize?: boolean;
}

interface SidepanelProps extends ISettingsProps {
    inHome: boolean;
    showKeymap?: boolean;
    showSerialButtons?: boolean;
    showFileList?: boolean;
    showFullscreenButton?: boolean;
    showHostMultiplayerGameButton?: boolean;
    collapseEditorTools?: boolean;
    simSerialActive?: boolean;
    deviceSerialActive?: boolean;
    tutorialOptions?: pxt.tutorial.TutorialOptions;
    /** An optional tutorial layout mode where the sim is on the left and instructions are at the top, regardless of screen size. */
    tutorialSimSidebar?: boolean;
    onTutorialStepChange?: (step: number) => void;
    onTutorialComplete?: () => void;
    setEditorOffset?: () => void;
    showMiniSim: (visible?: boolean) => void;
    openSerial: (isSim: boolean) => void;
    handleHardwareDebugClick: () => void;
    handleFullscreenButtonClick: () => void;
}

export class Sidepanel extends data.Component<SidepanelProps, SidepanelState> {
    protected simPanelRef: HTMLDivElement;

    constructor(props: SidepanelProps) {
        super(props);

        if (props.tutorialOptions?.tutorial && !props.tutorialSimSidebar) {
            this.props.showMiniSim(true);
        }

        this.updateShouldResize = this.updateShouldResize.bind(this);
    }

    UNSAFE_componentWillReceiveProps(props: SidepanelProps) {
        // This is necessary because we are not properly mounting and
        // unmounting the component as we enter/exit the editor. We
        // instead manually reset the state as we transition.
        if (!props.tutorialSimSidebar
            && ((!this.props.tutorialOptions && props.tutorialOptions)
                    || (this.props.inHome && !props.inHome && props.tutorialOptions)
                    || (this.props.tutorialOptions?.tutorial && props.tutorialOptions?.tutorial && this.props.tutorialOptions.tutorial !== props.tutorialOptions.tutorial))) {
            this.props.showMiniSim(true);
        } else if (
            (!this.props.inHome && props.inHome) ||
            (this.props.tutorialOptions && !props.tutorialOptions)
        ) {
            this.showSimulator();
        }
    }

    componentDidMount(): void {
        window.addEventListener('resize', this.updateShouldResize);
        this.updateShouldResize();
    }

    componentWillUnmount(): void {
        window.removeEventListener('resize', this.updateShouldResize);
    }

    componentDidUpdate(props: SidepanelProps, state: SidepanelState) {
        if ((this.state.height || state.height) && this.state.height != state.height) {
            this.props.setEditorOffset();
        }

        this.updateShouldResize();
    }

    private updateShouldResize() {
        const shouldResize = pxt.BrowserUtils.isTabletSize() || this.props.tutorialSimSidebar;
        if (shouldResize != this.state.shouldResize) {
            let height = this.state.height;
            if (shouldResize && this.state.height === undefined && this.state.lastResizeHeight !== undefined) {
                height = this.state.lastResizeHeight;
            }

            this.setState({ shouldResize, height });
        }
    }

    protected tryShowSimulator = () => {
        const isTabTutorial = this.props.tutorialOptions?.tutorial && !pxt.BrowserUtils.useOldTutorialLayout();
        const hasSimulator = !pxt.appTarget.simulator?.headless;
        const includeSimulator = (!isTabTutorial || this.props.tutorialSimSidebar) && hasSimulator;
        if (includeSimulator) {
            this.showSimulator();
        }
    }

    protected showSimulator = () => {
        this.props.showMiniSim(false);
        simulator.driver.focus();
    }

    protected handleSimSerialClick = () => {
        this.props.openSerial(true);
    }

    protected handleDeviceSerialClick = () => {
        this.props.openSerial(false);
    }

    protected handleSimOverlayClick = () => {
        const { tutorialOptions, handleFullscreenButtonClick } = this.props;
        if (!tutorialOptions || pxt.BrowserUtils.useOldTutorialLayout()) {
            handleFullscreenButtonClick();
        } else {
            this.tryShowSimulator();
        }
    }

    protected handleSimPanelRef = (c: HTMLDivElement) => {
        this.simPanelRef = c;
        if (c && typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
                const scrollVisible = c.scrollHeight > c.clientHeight;
                if (scrollVisible)
                    this.simPanelRef?.classList.remove("invisibleScrollbar");
                else
                    this.simPanelRef?.classList.add("invisibleScrollbar");
            })
            observer.observe(c);
        }
    }

    protected setComponentHeight = (height?: number, isResize?: boolean) => {
        if (height != this.state.height || isResize != this.state.resized) {
            this.setState({
                resized: this.state.resized || isResize,
                height: height,
                lastResizeHeight: isResize ? height : this.state.lastResizeHeight});
        }
    }

    onHostMultiplayerGameClick = (evt: any) => {
        evt.preventDefault();
        pxt.tickEvent("sidepanel.hostmultiplayergame");
        this.props.parent.showShareDialog(undefined, "multiplayer");
    }

    onOpenInVSCodeClick = (evt: any) => {
        evt.preventDefault();
        pxt.tickEvent("sidepanel.openinvscode");
        this.props.parent.showShareDialog(undefined, "vscode");
    }

    onResizeDrag = (newSize: number) => {
        this.setComponentHeight(newSize, true);
    }

    onResizeEnd = (newSize: number) => {
        pxt.tickEvent("tutorial.resizeInstructions",  {newSize });
    }

    renderCore() {
        const { parent, inHome, showKeymap, showSerialButtons, showFileList, showFullscreenButton, showHostMultiplayerGameButton,
            collapseEditorTools, simSerialActive, deviceSerialActive, tutorialOptions,
            handleHardwareDebugClick, onTutorialStepChange, onTutorialComplete } = this.props;

        const hasSimulator = !pxt.appTarget.simulator?.headless;
        const showOpenInVscodeButton = parent.isJavaScriptActive() && pxt.appTarget?.appTheme?.showOpenInVscode;

        const simContainerClassName = classList(
            "simulator-container",
            !this.props.tutorialSimSidebar && "hidden"
        );
        const outerTutorialContainerClassName = classList(
            "editor-sidebar",
            "tutorial-container-outer",
            this.props.tutorialSimSidebar && "topInstructions"
        );
        const editorSidebarClassName = classList(
            "editor-sidebar",
            this.props.tutorialSimSidebar && "tutorial-sim"
        );

        const editorSidebarHeight = this.state.shouldResize && this.state.height !== undefined ? `${this.state.height}px` : undefined; // Should we use this regardless of shouldResize?

        const tutorialContainer = tutorialOptions ? <TutorialContainer
            parent={parent}
            tutorialId={tutorialOptions.tutorial}
            name={tutorialOptions.tutorialName}
            steps={tutorialOptions.tutorialStepInfo}
            currentStep={tutorialOptions.tutorialStep}
            tutorialOptions={tutorialOptions}
            hideIteration={tutorialOptions.metadata?.hideIteration}
            hasTemplate={!!tutorialOptions.templateCode}
            preferredEditor={tutorialOptions.metadata?.preferredEditor}
            tutorialSimSidebar={this.props.tutorialSimSidebar}
            hasBeenResized={this.state.resized && this.state.shouldResize}
            onTutorialStepChange={onTutorialStepChange}
            onTutorialComplete={onTutorialComplete}
            setParentHeight={newSize => this.setComponentHeight(newSize, false)} /> : undefined;

        return <div id="simulator" className="simulator">
            {!hasSimulator && <div id="boardview" className="headless-sim" role="region" aria-label={lf("Simulator")} tabIndex={-1} />}
            <div id="editorSidebar" className={editorSidebarClassName} style={!this.props.tutorialSimSidebar ? { height: editorSidebarHeight } : undefined}>
                <div className={simContainerClassName}>
                    <div className={`ui items simPanel ${showHostMultiplayerGameButton ? "multiplayer-preview" : ""}`} ref={this.handleSimPanelRef}>
                        <div id="boardview" className="ui vertical editorFloat" role="region" aria-label={lf("Simulator")} tabIndex={inHome ? -1 : 0} />
                        {showHostMultiplayerGameButton && <div className="ui item grid centered portrait multiplayer-presence">
                            <SimulatorPresenceBar />
                        </div>}
                        <simtoolbar.SimulatorToolbar parent={parent} collapsed={collapseEditorTools} simSerialActive={simSerialActive} devSerialActive={deviceSerialActive} showSimulatorSidebar={this.tryShowSimulator} />
                        {showKeymap && <keymap.Keymap parent={parent} />}
                        <div className="ui item portrait hide hidefullscreen">
                            {pxt.options.debug && <Button key="hwdebugbtn" className="teal" icon="xicon chip" text={"Dev Debug"} onClick={handleHardwareDebugClick} />}
                        </div>
                        <div className="ui item grid centered portrait hide hidefullscreen">
                            {showOpenInVscodeButton && <Button className={"teal hostmultiplayergame-button"} icon={"icon share"} text={lf("Open in VS Code")} ariaLabel={lf("Open in Visual Studio Code for Web")} onClick={this.onOpenInVSCodeClick} />}
                        </div>
                        <div className="ui item grid centered portrait hide hidefullscreen">
                            {showHostMultiplayerGameButton && <Button className={"teal hostmultiplayergame-button"} icon={"xicon multiplayer"} text={lf("Host multiplayer game")} ariaLabel={lf("Host multiplayer game")} onClick={this.onHostMultiplayerGameClick} />}
                        </div>
                        {showSerialButtons && <div id="serialPreview" className="ui editorFloat portrait hide hidefullscreen">
                            <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={this.handleSimSerialClick} parent={parent} />
                            <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={this.handleDeviceSerialClick} parent={parent} />
                        </div>}

                        {showFileList && <filelist.FileList parent={parent} />}
                        {showFullscreenButton && <div id="miniSimOverlay" role="button" title={lf("Open in fullscreen")} onClick={this.handleSimOverlayClick} />}
                    </div>
                </div>
            </div>
            {tutorialOptions &&
                <div className={this.props.tutorialSimSidebar ? "topInstructionsWrapper" : ""}>
                    {this.state.shouldResize ?
                        <VerticalResizeContainer
                            id="tutorialWrapper"
                            className={outerTutorialContainerClassName}
                            maxHeight="500px"
                            minHeight="100px"
                            initialHeight={editorSidebarHeight}
                            resizeEnabled={this.state.shouldResize}
                            onResizeDrag={this.onResizeDrag}
                            onResizeEnd={this.onResizeEnd}>
                                {tutorialContainer}
                        </VerticalResizeContainer> :
                        <div id="tutorialWrapper" className={outerTutorialContainerClassName}>
                            {tutorialContainer}
                        </div>}
                </div>}
        </div>
    }
}
