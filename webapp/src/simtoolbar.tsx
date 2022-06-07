/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface SimulatorProps extends ISettingsProps {
    collapsed?: boolean;
    simSerialActive?: boolean;
    devSerialActive?: boolean;
    csvSerialActive?: boolean;

    showSimulatorSidebar?: () => void;
}

export class SimulatorToolbar extends data.Component<SimulatorProps, {}> {

    constructor(props: SimulatorProps) {
        super(props);
        this.state = {
        }

        // iOS requires interactive consent to use audio
        if (pxt.BrowserUtils.isIOS())
            this.props.parent.setMute(true);

        this.toggleMute = this.toggleMute.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.openInstructions = this.openInstructions.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
        this.toggleSimulatorCollapse = this.toggleSimulatorCollapse.bind(this);
        this.openDeviceSimulator = this.openDeviceSimulator.bind(this);
        this.openCsvSerial = this.openCsvSerial.bind(this);
        this.openDeviceSerial = this.openDeviceSerial.bind(this);
        this.takeScreenshot = this.takeScreenshot.bind(this);
        this.toggleDebug = this.toggleDebug.bind(this);
    }

    openInstructions() {
        pxt.tickEvent("simulator.make", undefined, { interactiveConsent: true });
        this.props.parent.openInstructions();
    }

    startStopSimulator() {
        pxt.tickEvent('simulator.startstop', undefined, { interactiveConsent: true });
        this.props.parent.startStopSimulator({ clickTrigger: true });
    }

    restartSimulator() {
        pxt.tickEvent('simulator.restart', undefined, { interactiveConsent: true });
        this.props.parent.restartSimulator();
    }

    toggleDebug() {
        pxt.tickEvent("simulator.debug", undefined, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    toggleMute() {
        pxt.tickEvent("simulator.mute", { view: 'computer', muteTo: '' + !this.props.parent.state.mute }, { interactiveConsent: true });
        this.props.parent.toggleMute();
    }

    toggleSimulatorFullscreen() {
        pxt.tickEvent("simulator.fullscreen", { view: 'computer', fullScreenTo: '' + !this.props.parent.state.fullscreen }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorFullscreen();
    }

    toggleSimulatorCollapse() {
        pxt.tickEvent("simulator.toggleCollapse", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorCollapse();
    }

    openDeviceSerial() {
        pxt.tickEvent("simulator.fullscreen.serial.simulator", { }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorFullscreen();
        this.props.parent.openDeviceSerial();
    }

    openDeviceSimulator() {
        pxt.tickEvent("simulator.fullscreen.serial.device", { }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorFullscreen();
        this.props.parent.openSimSerial();
    }

    openCsvSerial() {
        pxt.tickEvent("simulator.fullscreen.serial.csv", { }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorFullscreen();
        this.props.parent.openCsvSerial();
    }

    takeScreenshot() {
        pxt.tickEvent("simulator.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.downloadScreenshotAsync();
    }

    renderCore() {
        const { collapsed, devSerialActive, parent, simSerialActive, csvSerialActive, showSimulatorSidebar } = this.props;

        const parentState = parent.state;
        if (!parentState.currFile || parentState.home) return <div />

        const targetTheme = pxt.appTarget.appTheme;
        const simOpts = pxt.appTarget.simulator;
        const sandbox = pxt.shell.isSandboxMode();
        const make = !sandbox && parentState.showParts && targetTheme.instructions;

        const simState = parentState.simState;
        const isRunning = simState == pxt.editor.SimState.Running;
        const isStarting = simState == pxt.editor.SimState.Starting;
        const isSimulatorPending = simState == pxt.editor.SimState.Pending;
        const isFullscreen = parentState.fullscreen;
        const isMuted = parentState.mute;
        const inTutorial = !!parentState.tutorialOptions && !!parentState.tutorialOptions.tutorial;
        const isTabTutorial = inTutorial && !pxt.BrowserUtils.useOldTutorialLayout();
        const inCodeEditor = parent.isBlocksActive() || parent.isJavaScriptActive() || parent.isPythonActive();

        const run = true;
        const restart = run && !simOpts.hideRestart;
        // We hide debug button in Monaco because it's not implemented yet.
        const debug = targetTheme.debugger && !inTutorial && !pxt.BrowserUtils.isIE();
        const debugging = parentState.debugging;
        // we need to escape full screen from a tutorial!
        const fullscreen = run && !simOpts.hideFullscreen && !sandbox;
        const audio = run && targetTheme.hasAudio;
        const isHeadless = simOpts.headless;
        const screenshot = !!targetTheme.simScreenshot;
        const screenshotClass = !!parentState.screenshoting ? "loading" : "";
        const debugBtnEnabled = !isStarting && !isSimulatorPending && inCodeEditor;
        const runControlsEnabled = !debugging && !isStarting && !isSimulatorPending;
        const collapse = !targetTheme.bigRunButton;

        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const debugTooltip = lf("Toggle debug mode");
        const keymapTooltip = lf("View simulator keyboard shortcuts");
        const sidebarTooltip = lf("Show simulator in sidebar");
        const fullscreenTooltip = isFullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const muteTooltip = isMuted ? lf("Unmute audio") : lf("Mute audio");
        const screenshotTooltip = targetTheme.simScreenshotKey ? lf("Take Screenshot (shortcut {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");
        const collapseIconTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        const simSerialTooltip = lf("Open simulator console");
        const devSerialTooltip = lf("Open device console");
        const csvSerialTooltip = lf("Open CSV simulator");

        const showSerialEditorSection = isFullscreen && (simSerialActive || devSerialActive || csvSerialActive);

        return <aside className={"ui item grid centered simtoolbar" + (sandbox ? "" : " portrait ")} role="complementary" aria-label={lf("Simulator toolbar")}>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {isTabTutorial && <sui.Button key='simsidebarbtn' className="sidebar-button tablet only" icon="external flipped" title={sidebarTooltip} onClick={showSimulatorSidebar} />}
                {make && <sui.Button disabled={debugging} icon='configure' className="secondary" title={makeTooltip} onClick={this.openInstructions} />}
                {run && !targetTheme.bigRunButton && <PlayButton parent={parent} simState={parentState.simState} debugging={parentState.debugging} />}
                {fullscreen && <sui.Button key='fullscreenbtn' className="fullscreen-button tablet only hidefullscreen" icon="xicon fullscreen" title={fullscreenTooltip} onClick={this.toggleSimulatorFullscreen} />}
                {restart && <sui.Button disabled={!runControlsEnabled} key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onClick={this.restartSimulator} />}
                {run && debug && <sui.Button disabled={!debugBtnEnabled} key='debugbtn' className={`debug-button ${debugging ? "orange" : ""}`} icon="icon bug" title={debugTooltip} onClick={this.toggleDebug} />}
                {collapse && <sui.Button
                    className={`expand-button portrait only editortools-btn hidefullscreen`}
                    icon={`${collapsed ? 'play' : 'stop'}`}
                    title={collapseIconTooltip} onClick={this.toggleSimulatorCollapse}
                />}
            </div>
            {!isHeadless && <div className={`ui icon tiny buttons computer only`} style={{ padding: "0" }}>
                {audio && <sui.Button key='mutebtn' className={`mute-button ${isMuted ? 'red' : ''}`} icon={`${isMuted ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={this.toggleMute} />}
                {simOpts.keymap && <sui.Button key='keymap' className="keymap-button" icon="keyboard" title={keymapTooltip} onClick={parent.toggleKeymap} />}
            </div>}
            {showSerialEditorSection && <div className={`ui item tiny buttons full-screen-console`}>
                {simSerialActive && <sui.Button
                    icon="list"
                    className="purple"
                    title={simSerialTooltip}
                    onClick={this.openDeviceSimulator}
                />}
                {devSerialActive && <sui.Button
                    icon="usb"
                    className="purple"
                    title={devSerialTooltip}
                    onClick={this.openDeviceSerial}
                />}
                {csvSerialActive && <sui.Button
                    icon="table"
                    className="purple"
                    title={csvSerialTooltip}
                    onClick={this.openCsvSerial}
                />}
            </div>}
            {!isHeadless && <div className={`ui icon tiny buttons computer only`} style={{ padding: "0" }}>
                {screenshot && <sui.Button disabled={!isRunning} key='screenshotbtn' className={`screenshot-button ${screenshotClass}`} icon={`icon camera left`} title={screenshotTooltip} onClick={this.takeScreenshot} />}
                {fullscreen && <sui.Button key='fullscreenbtn' className={`fullscreen-button`} icon={`xicon ${isFullscreen ? 'fullscreencollapse' : 'fullscreen'}`} title={fullscreenTooltip} onClick={this.toggleSimulatorFullscreen} />}
            </div>}
        </aside >;
    }
}

interface PlayButtonProps extends sui.ButtonProps, ISettingsProps {
    className?: string;
    simState?: pxt.editor.SimState;
    debugging?: boolean;
}

export class PlayButton extends sui.StatelessUIElement<PlayButtonProps> {
    constructor(props: PlayButtonProps) {
        super(props);
    }

    startStopSimulator = () => {
        pxt.tickEvent('simulator.startstop', undefined, { interactiveConsent: true });
        this.props.parent.startStopSimulator({ clickTrigger: true });
    }

    renderCore() {
        const simState = this.props.simState;
        const isRunning = simState == pxt.editor.SimState.Running;
        const isStarting = simState == pxt.editor.SimState.Starting;
        const isSimulatorPending = simState == pxt.editor.SimState.Pending;
        const runControlsEnabled = !this.props.debugging && !isStarting && !isSimulatorPending;
        const runTooltip = (() => {
            switch (simState) {
                case pxt.editor.SimState.Stopped:
                    return lf("Start the simulator");
                case pxt.editor.SimState.Pending:
                case pxt.editor.SimState.Starting:
                    return lf("Starting the simulator");
                case pxt.editor.SimState.Running:
                    return lf("Stop the simulator");
            }
        })();

        return <sui.Button disabled={!runControlsEnabled} key='runbtn' className={`play-button ${this.props.className || ""} ${(isRunning) ? "stop" : "play"}`} icon={(isRunning) ? "stop" : "play green"} title={runTooltip} onClick={this.startStopSimulator} />
    }
}