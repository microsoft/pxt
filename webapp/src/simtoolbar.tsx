/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface SimulatorProps extends ISettingsProps {
}

export class SimulatorToolbar extends data.Component<SimulatorProps, {}> {

    constructor(props: SimulatorProps) {
        super(props);
        this.state = {
        }

        this.toggleTrace = this.toggleTrace.bind(this);
        this.toggleMute = this.toggleMute.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.openInstructions = this.openInstructions.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
        this.toggleSimulatorCollapse = this.toggleSimulatorCollapse.bind(this);
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

    toggleTrace() {
        pxt.tickEvent("simulator.trace", undefined, { interactiveConsent: true });
        this.props.parent.toggleTrace();
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

    takeScreenshot() {
        pxt.tickEvent("simulator.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.downloadScreenshotAsync().done();
    }

    renderCore() {
        const parentState = this.props.parent.state;
        if (!parentState.currFile) return <div />

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

        const run = true; // !compileBtn || !pxt.appTarget.simulator.autoRun || !isBlocks;
        const restart = run && !simOpts.hideRestart;
        const trace = !!targetTheme.enableTrace;
        // We hide debug button in Monaco because it's not implemented yet.
        const debug = targetTheme.debugger && !inTutorial && !pxt.BrowserUtils.isIE() && this.props.parent.isBlocksEditor();
        const tracing = this.props.parent.state.tracing;
        const traceTooltip = tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo")
        const debugging = parentState.debugging;
        const fullscreen = run && !inTutorial && !simOpts.hideFullscreen && !sandbox;
        const audio = run && targetTheme.hasAudio;
        const isHeadless = simOpts.headless;
        const collapse = !!targetTheme.pairingButton;
        const screenshot = !!targetTheme.simScreenshot;
        const screenshotClass = !!parentState.screenshoting ? "loading" : "";
        if (isHeadless) return <div />;
        const debugBtnEnabled = !isStarting && !isSimulatorPending;
        const runControlsEnabled = !debugging && !isStarting && !isSimulatorPending;

        const runTooltip = [lf("Start the simulator"), lf("Starting the simulator"), lf("Stop the simulator")][simState];
        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const debugTooltip = lf("Toggle debug mode");
        const fullscreenTooltip = isFullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const muteTooltip = isMuted ? lf("Unmute audio") : lf("Mute audio");
        const collapseTooltip = lf("Hide the simulator");
        const screenshotTooltip = targetTheme.simScreenshotKey ? lf("Take Screenshot (shortcut {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");

        return <aside className={"ui item grid centered simtoolbar" + (sandbox ? "" : " portrait hide")} role="complementary" aria-label={lf("Simulator toolbar")}>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {make ? <sui.Button disabled={debugging} icon='configure' className="secondary" title={makeTooltip} onClick={this.openInstructions} /> : undefined}
                {run ? <sui.Button disabled={!runControlsEnabled} key='runbtn' className={`play-button ${(isRunning || debugging) ? "stop" : "play"}`} icon={(isRunning || debugging) ? "stop" : "play green"} title={runTooltip} onClick={this.startStopSimulator} /> : undefined}
                {restart ? <sui.Button disabled={!runControlsEnabled} key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onClick={this.restartSimulator} /> : undefined}
                {run && debug ? <sui.Button disabled={!debugBtnEnabled} key='debugbtn' className={`debug-button ${debugging ? "orange" : ""}`} icon="icon bug" title={debugTooltip} onClick={this.toggleDebug} /> : undefined}
                {trace ? <sui.Button key='trace' className={`trace-button ${tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={this.toggleTrace} /> : undefined}
            </div>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {audio ? <sui.Button key='mutebtn' className={`mute-button ${isMuted ? 'red' : ''}`} icon={`${isMuted ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={this.toggleMute} /> : undefined}
            </div>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {screenshot ? <sui.Button disabled={!isRunning} key='screenshotbtn' className={`screenshot-button ${screenshotClass}`} icon={`icon camera left`} title={screenshotTooltip} onClick={this.takeScreenshot} /> : undefined}
                {collapse && !isFullscreen ? <sui.Button key='collapsebtn' className={`collapse-button`} icon={`icon toggle left`} title={collapseTooltip} onClick={this.toggleSimulatorCollapse} /> : undefined}
                {fullscreen ? <sui.Button key='fullscreenbtn' className={`fullscreen-button`} icon={`xicon ${isFullscreen ? 'fullscreencollapse' : 'fullscreen'}`} title={fullscreenTooltip} onClick={this.toggleSimulatorFullscreen} /> : undefined}
            </div>
        </aside >;
    }
}