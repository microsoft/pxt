/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface SimulatorProps extends ISettingsProps {
    debug?: boolean;
}

export class SimulatorToolbar extends data.Component<SimulatorProps, {}> {

    openInstructions() {
        pxt.tickEvent("simulator.make", undefined, { interactiveConsent: true });
        this.props.parent.openInstructions();
    }

    startStopSimulator() {
        pxt.tickEvent('simulator.startstop', undefined, { interactiveConsent: true });
        this.props.parent.startStopSimulator();
    }

    restartSimulator() {
        pxt.tickEvent('simulator.restart', undefined, { interactiveConsent: true });
        this.props.parent.restartSimulator();
    }

    toggleTrace() {
        pxt.tickEvent("simulator.trace", undefined, { interactiveConsent: true });
        this.props.parent.toggleTrace();
    }

    toggleMute() {
        pxt.tickEvent("simulator.mute", { view: 'computer', muteTo: '' + !this.props.parent.state.mute }, { interactiveConsent: true });
        this.props.parent.toggleMute();
    }

    toggleSimulatorFullscreen() {
        pxt.tickEvent("simulator.fullscreen", { view: 'computer', fullScreenTo: '' + !this.props.parent.state.fullscreen }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorFullscreen();
    }

    renderCore() {
        const parentState = this.props.parent.state;
        const targetTheme = pxt.appTarget.appTheme;
        const simOpts = pxt.appTarget.simulator;
        const sandbox = pxt.shell.isSandboxMode();
        const make = !sandbox && parentState.showParts && simOpts && (simOpts.instructions || (simOpts.parts && pxt.options.debug));

        const isRunning = parentState.running;
        const isFullscreen = parentState.fullscreen;
        const isTracing = parentState.tracing;
        const isMuted = parentState.mute;
        const inTutorial = !!parentState.tutorialOptions && !!parentState.tutorialOptions.tutorial;

        const run = true; // !compileBtn || !pxt.appTarget.simulator.autoRun || !isBlocks;
        const restart = run && !simOpts.hideRestart;
        const trace = run && simOpts.enableTrace;
        const fullscreen = run && !inTutorial && !simOpts.hideFullscreen
        const audio = run && !inTutorial && targetTheme.hasAudio;
        const isHeadless = simOpts.headless;
        if (isHeadless) return <div />;

        const runTooltip = isRunning ? lf("Stop the simulator") : lf("Start the simulator");
        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const traceTooltip = parentState.tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo");
        const fullscreenTooltip = isFullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const muteTooltip = isMuted ? lf("Unmute audio") : lf("Mute audio");

        return <aside className="ui item grid centered portrait hide simtoolbar" role="complementary" aria-label={lf("Simulator toolbar") }>
            <div className={`ui icon tiny buttons ${isFullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                {make ? <sui.Button icon='configure' className="secondary" title={makeTooltip} onClick={() => this.openInstructions() } /> : undefined}
                {run ? <sui.Button key='runbtn' className={`play-button ${isRunning ? "stop" : "play"}`} icon={isRunning ? "stop" : "play green"} title={runTooltip} onClick={() => this.startStopSimulator() } /> : undefined}
                {restart ? <sui.Button key='restartbtn' className={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator() } /> : undefined}
                {trace ? <sui.Button key='debug' className={`trace-button ${isTracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={() => this.toggleTrace() } /> : undefined}
            </div>
            <div className={`ui icon tiny buttons ${isFullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                {audio ? <sui.Button key='mutebtn' className={`mute-button ${isMuted ? 'red' : ''}`} icon={`${isMuted ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={() => this.toggleMute() } /> : undefined}
                {fullscreen ? <sui.Button key='fullscreenbtn' className={`fullscreen-button`} icon={`xicon ${isFullscreen ? 'fullscreencollapse' : 'fullscreen'}`} title={fullscreenTooltip} onClick={() => this.toggleSimulatorFullscreen() } /> : undefined}
            </div>
        </aside>;
    }
}