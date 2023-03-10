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
import { fireClickOnEnter } from "./util";

interface SidepanelState {
    tutorialParentHeight?: number;
}

interface SidepanelProps extends pxt.editor.ISettingsProps {
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
    topInstructionsTutorial?: boolean;
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
    }

    UNSAFE_componentWillReceiveProps(props: SidepanelProps) {
        // This is necessary because we are not properly mounting and
        // unmounting the component as we enter/exit the editor. We
        // instead manually reset the state as we transition.
        if ((!this.props.tutorialOptions && props.tutorialOptions)
            || (this.props.inHome && !props.inHome && props.tutorialOptions)
            || (this.props.tutorialOptions?.tutorial && props.tutorialOptions?.tutorial
                && this.props.tutorialOptions.tutorial !== props.tutorialOptions.tutorial)) {
            // this.showTutorialTab();
        } else if (!this.props.inHome && props.inHome
            || (this.props.tutorialOptions && !props.tutorialOptions)) {
            this.showSimulatorTab();
        }
    }

    componentDidUpdate(props: SidepanelProps, state: SidepanelState) {
        if ((this.state.tutorialParentHeight || state.tutorialParentHeight) && this.state.tutorialParentHeight != state.tutorialParentHeight) this.props.setEditorOffset();
    }


    protected tryShowSimulatorTab = () => {
        const isTabTutorial = this.props.tutorialOptions?.tutorial && !pxt.BrowserUtils.useOldTutorialLayout();
        const hasSimulator = !pxt.appTarget.simulator?.headless;
        const includeSimulatorTab = (!isTabTutorial || this.props.topInstructionsTutorial) && hasSimulator;
        if (includeSimulatorTab) {
            this.showSimulatorTab();
        }
    }

    protected showSimulatorTab = () => {
        this.props.showMiniSim(false);
        // this.setState({ activeTab: SIMULATOR_TAB, height: undefined });
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
            this.tryShowSimulatorTab();
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

    protected setTutorialParentHeight = (height?: number) => {
        if (height != this.state.tutorialParentHeight) this.setState({ tutorialParentHeight: height });
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

    renderCore() {
        const { parent, inHome, showKeymap, showSerialButtons, showFileList, showFullscreenButton, showHostMultiplayerGameButton,
            collapseEditorTools, simSerialActive, deviceSerialActive, tutorialOptions,
            handleHardwareDebugClick, onTutorialStepChange, onTutorialComplete } = this.props;
        const { tutorialParentHeight } = this.state;

        const hasSimulator = !pxt.appTarget.simulator?.headless;
        const marginHeight = "3rem"; // Simplify, add to height directly, probably just set in css now that it's constant.
        const showOpenInVscodeButton = parent.isJavaScriptActive();
        const tutorialContainerClassName = `sidebarContainer tab-tutorial${this.props.topInstructionsTutorial ? " topInstructions" : ""}`;

        return <div id="simulator" className="simulator">
            {!hasSimulator && <div id="boardview" className="headless-sim" role="region" aria-label={lf("Simulator")} tabIndex={-1} />}
            <div id="editorSidebar" className="sidebarContainer tab-simulator">
                <div className={`ui items simPanel ${showHostMultiplayerGameButton ? "multiplayer-preview" : ""}`} ref={this.handleSimPanelRef}>
                    <div id="boardview" className="ui vertical editorFloat" role="region" aria-label={lf("Simulator")} tabIndex={inHome ? -1 : 0} />
                    {showHostMultiplayerGameButton && <div className="ui item grid centered portrait multiplayer-presence">
                        <SimulatorPresenceBar />
                    </div>}
                    <simtoolbar.SimulatorToolbar parent={parent} collapsed={collapseEditorTools} simSerialActive={simSerialActive} devSerialActive={deviceSerialActive} showSimulatorSidebar={this.tryShowSimulatorTab} />
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
            {tutorialOptions &&
                <div
                    id="tutorialWrapper"
                    className={tutorialContainerClassName}
                    style={tutorialParentHeight ? { height: `calc(${tutorialParentHeight}px + ${marginHeight})` } : undefined}>
                    <TutorialContainer
                        parent={parent}
                        tutorialId={tutorialOptions.tutorial}
                        name={tutorialOptions.tutorialName}
                        steps={tutorialOptions.tutorialStepInfo}
                        currentStep={tutorialOptions.tutorialStep}
                        tutorialOptions={tutorialOptions}
                        hideIteration={tutorialOptions.metadata?.hideIteration}
                        hasTemplate={!!tutorialOptions.templateCode}
                        preferredEditor={tutorialOptions.metadata?.preferredEditor}
                        onTutorialStepChange={onTutorialStepChange}
                        onTutorialComplete={onTutorialComplete}
                        setParentHeight={this.setTutorialParentHeight} />
                </div>}
        </div>
    }
}
