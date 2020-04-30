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

        // iOS requires interactive consent to use audio
        if (pxt.BrowserUtils.isIOS())
            this.props.parent.setMute(true);

        this.toggleMute = this.toggleMute.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.openInstructions = this.openInstructions.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
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

    takeScreenshot() {
        pxt.tickEvent("simulator.takescreenshot", { view: 'computer', collapsedTo: '' + !this.props.parent.state.collapseEditorTools }, { interactiveConsent: true });
        this.props.parent.downloadScreenshotAsync().done();
    }

    renderCore() {
        const parentState = this.props.parent.state;
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
        const debugBtnEnabled = !isStarting && !isSimulatorPending;
        const runControlsEnabled = !debugging && !isStarting && !isSimulatorPending;

        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const debugTooltip = lf("Toggle debug mode");
        const keymapTooltip = lf("View simulator keyboard shortcuts");
        const fullscreenTooltip = isFullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const muteTooltip = isMuted ? lf("Unmute audio") : lf("Mute audio");
        const screenshotTooltip = targetTheme.simScreenshotKey ? lf("Take Screenshot (shortcut {0})", targetTheme.simScreenshotKey) : lf("Take Screenshot");

        return <aside className={"ui item grid centered simtoolbar" + (sandbox ? "" : " portrait ")} role="complementary" aria-label={lf("Simulator toolbar")}>
            <div className={`ui icon tiny buttons`} style={{ padding: "0" }}>
                {make && <sui.Button disabled={debugging} icon='configure' className="secondary" title={makeTooltip} onClick={this.openInstructions} />}
                {run && !targetTheme.bigRunButton && <PlayButton parent={this.props.parent} simState={parentState.simState} debugging={parentState.debugging} />}
                {restart && <sui.Button disabled={!runControlsEnabled} key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onClick={this.restartSimulator} />}
                {run && debug && <sui.Button disabled={!debugBtnEnabled} key='debugbtn' className={`debug-button ${debugging ? "orange" : ""}`} icon="icon bug" title={debugTooltip} onClick={this.toggleDebug} />}
            </div>
            {!isHeadless && <div className={`ui icon tiny buttons computer only`} style={{ padding: "0" }}>
                {audio && <sui.Button key='mutebtn' className={`mute-button ${isMuted ? 'red' : ''}`} icon={`${isMuted ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={this.toggleMute} />}
                {simOpts.keymap && <sui.Button key='keymap' className="keymap-button" icon="keyboard" title={keymapTooltip} onClick={this.props.parent.toggleKeymap} />}
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