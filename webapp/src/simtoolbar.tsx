/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import MuteState = pxt.editor.MuteState;
import SimState = pxt.editor.SimState;
import ISettingsProps = pxt.editor.ISettingsProps;

export interface SimulatorProps extends ISettingsProps {
    collapsed?: boolean;
    simSerialActive?: boolean;
    devSerialActive?: boolean;

    showSimulatorSidebar?: () => void;
}

export class SimulatorToolbar extends data.Component<SimulatorProps, {}> {

    constructor(props: SimulatorProps) {
        super(props);
        this.state = {
        }

        // iOS requires interactive consent to use audio
        if (pxt.BrowserUtils.isIOS())
            this.props.parent.setMute(MuteState.Disabled);

        this.toggleMute = this.toggleMute.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.openInstructions = this.openInstructions.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
        this.toggleSimulatorCollapse = this.toggleSimulatorCollapse.bind(this);
        this.openDeviceSimulator = this.openDeviceSimulator.bind(this);
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

    takeScreenshot() {
        pxt.tickEvent("simulator.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.downloadScreenshotAsync();
    }

    renderCore() {
        const { collapsed, devSerialActive, parent, simSerialActive } = this.props;

        const parentState = parent.state;
        if (!parentState.currFile || parentState.home) return <div />

        const targetTheme = pxt.appTarget.appTheme;
        const simOpts = pxt.appTarget.simulator;
        const sandbox = pxt.shell.isSandboxMode();
        const make = !sandbox && parentState.showParts && targetTheme.instructions;

        const simState = parentState.simState;
        const isRunning = simState == SimState.Running;
        const isStarting = simState == SimState.Starting;
        const isSimulatorPending = simState == SimState.Pending;
        const isFullscreen = parentState.fullscreen;
        const inTutorial = !!parentState.tutorialOptions && !!parentState.tutorialOptions.tutorial;
        const isTabTutorial = inTutorial && !pxt.BrowserUtils.useOldTutorialLayout();
        const inCodeEditor = parent.isBlocksActive() || parent.isTextSourceCodeEditorActive() || parent.isPythonActive();

        const run = !simOpts.hideRun;
        const restart = run && !simOpts.hideRestart;
        const debug = targetTheme.debugger && !inTutorial && !pxt.BrowserUtils.isIE() && !pxt.shell.isReadOnly();
        const debugging = parentState.debugging;
        // we need to escape full screen from a tutorial!
        const fullscreen = run && !simOpts.hideFullscreen && !sandbox;
        const audio = run && targetTheme.hasAudio;
        const isHeadless = simOpts.headless;
        const screenshot = !!targetTheme.simScreenshot && !pxt.shell.isTimeMachineEmbed();
        const screenshotClass = !!parentState.screenshoting ? "loading" : "";
        const debugBtnEnabled = !isStarting && !isSimulatorPending && inCodeEditor;
        const runControlsEnabled = !debugging && !isStarting && !isSimulatorPending;
        const collapse = !targetTheme.bigRunButton;

        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const debugTooltip = lf("Toggle debug mode");
        const keymapTooltip = lf("View simulator keyboard shortcuts");
        const fullscreenTooltip = isFullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const screenshotTooltip = targetTheme.simScreenshotKey ? lf("Take Screenshot (shortcut {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");
        const collapseIconTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        const simSerialTooltip = lf("Open simulator console");
        const devSerialTooltip = lf("Open device console");

        const showSerialEditorSection = isFullscreen && (simSerialActive || devSerialActive);

        return <aside className={"ui item grid centered simtoolbar" + (sandbox ? "" : " portrait ")} role="complementary" aria-label={lf("Simulator toolbar")}>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {make && <sui.Button disabled={debugging} icon='configure' className="secondary" title={makeTooltip} onClick={this.openInstructions} />}
                {run && !targetTheme.bigRunButton && <PlayButton parent={parent} simState={parentState.simState} debugging={parentState.debugging} />}
                {fullscreen && <sui.Button key='fullscreenbtn' className="fullscreen-button tablet only hidefullscreen" icon="fas fa-expand-alt fa-flip-horizontal" fontAwesome={true} title={fullscreenTooltip} onClick={this.toggleSimulatorFullscreen} />}
                {restart && <sui.Button disabled={!runControlsEnabled} key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onClick={this.restartSimulator} />}
                {run && debug && <sui.Button disabled={!debugBtnEnabled} key='debugbtn' className={`debug-button ${debugging ? "active" : ""}`} icon="icon bug" title={debugTooltip} onClick={this.toggleDebug} />}
                {audio && isTabTutorial && <MuteButton onClick={this.toggleMute} state={parent.state.mute} className="hidefullscreen tutorial"/>}
                {collapse && <sui.Button
                    className={`expand-button portrait only editortools-btn hidefullscreen`}
                    icon={`${collapsed ? 'play' : 'stop'}`}
                    title={collapseIconTooltip} onClick={this.toggleSimulatorCollapse}
                />}
            </div>
            {!isHeadless && <div className={`ui icon tiny buttons computer only`} style={{ padding: "0" }}>
                {audio && <MuteButton onClick={this.toggleMute} state={parent.state.mute} />}
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
            </div>}
            {!isHeadless && <div className={`ui icon tiny buttons computer only`} style={{ padding: "0" }}>
                {screenshot && <sui.Button disabled={!isRunning} key='screenshotbtn' className={`screenshot-button ${screenshotClass}`} icon={`icon camera left`} title={screenshotTooltip} onClick={this.takeScreenshot} />}
                {fullscreen && <sui.Button key='fullscreenbtn' className={`fullscreen-button`} icon={`fas fa-flip-horizontal ${isFullscreen ? 'fa-compress-alt' : 'fa-expand-alt'}`} fontAwesome={true} title={fullscreenTooltip} onClick={this.toggleSimulatorFullscreen} />}
            </div>}
        </aside >;
    }
}

interface PlayButtonProps extends sui.ButtonProps, ISettingsProps {
    className?: string;
    simState?: SimState;
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
        const isRunning = simState == SimState.Running;
        const isStarting = simState == SimState.Starting;
        const isSimulatorPending = simState == SimState.Pending;
        const runControlsEnabled = !this.props.debugging && !isStarting && !isSimulatorPending;
        const runTooltip = (() => {
            switch (simState) {
                case SimState.Stopped:
                    return lf("Start the simulator");
                case SimState.Pending:
                case SimState.Starting:
                    return lf("Starting the simulator");
                case SimState.Running:
                    return lf("Stop the simulator");
            }

            return undefined;
        })();

        return <sui.Button disabled={!runControlsEnabled} key='runbtn' className={`play-button ${this.props.className || ""} ${(isRunning) ? "stop" : "play"}`} icon={(isRunning) ? "stop" : "play green"} title={runTooltip} onClick={this.startStopSimulator} />
    }
}

interface MuteButtonProps {
    onClick: () => void;
    state: MuteState;
    className?: string;
}

const MuteButton = ({onClick, state, className}: MuteButtonProps) => {
    let tooltip: string;

    switch (state) {
        case MuteState.Muted:
            tooltip = lf("Unmute audio");
            break;
        case MuteState.Unmuted:
            tooltip = lf("Mute audio");
            break;
        case MuteState.Disabled:
            tooltip = lf("Click inside the simulator to enable audio");
            break;
    }

    return <sui.Button
        className={`${className || ''} mute-button ${state === MuteState.Muted ? 'active' : ''}`}
        icon={`${state !== MuteState.Unmuted  ? 'volume off' : 'volume up'}`}
        disabled={state === MuteState.Disabled}
        title={tooltip}
        onClick={onClick} />;
}
