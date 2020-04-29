import * as React from "react";
import * as ReactDOM from 'react-dom';
import * as sui from "./sui";
import * as data from "./data";
import * as simulator from "./simulator";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface DebuggerToolbarProps extends ISettingsProps {
}

export interface DebuggerToolbarState {
    isDragging?: boolean;
    xPos?: number;
}

export class DebuggerToolbar extends data.Component<DebuggerToolbarProps, DebuggerToolbarState> {

    constructor(props: DebuggerToolbarProps) {
        super(props);
        this.state = {
        }

        this.restartSimulator = this.restartSimulator.bind(this);
        this.dbgPauseResume = this.dbgPauseResume.bind(this);
        this.dbgStepOver = this.dbgStepOver.bind(this);
        this.dbgStepInto = this.dbgStepInto.bind(this);
        this.dbgStepOut = this.dbgStepOut.bind(this);
        this.exitDebugging = this.exitDebugging.bind(this);
        this.toggleTrace = this.toggleTrace.bind(this);
    }

    restartSimulator() {
        pxt.tickEvent('debugger.restart', undefined, { interactiveConsent: true });
        this.props.parent.restartSimulator();
    }

    exitDebugging() {
        pxt.tickEvent('debugger.exit', undefined, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    dbgPauseResume() {
        pxt.tickEvent('debugger.pauseresume', undefined, { interactiveConsent: true });
        this.props.parent.dbgPauseResume();
    }

    dbgStepOver() {
        pxt.tickEvent('debugger.stepover', undefined, { interactiveConsent: true });
        this.props.parent.dbgStepOver();
    }

    dbgStepInto() {
        pxt.tickEvent('debugger.stepinto', undefined, { interactiveConsent: true });
        this.props.parent.dbgStepInto();
    }

    dbgStepOut() {
        pxt.tickEvent('debugger.stepout', undefined, { interactiveConsent: true });
        simulator.dbgStepOut();
    }

    toggleTrace() {
        pxt.tickEvent("simulator.trace", undefined, { interactiveConsent: true });
        this.props.parent.toggleTrace();
    }

    getMenuDom() {
        const node = ReactDOM.findDOMNode(this);
        return node && node.firstElementChild;
    }

    renderCore() {
        const parentState = this.props.parent.state;

        const simState = parentState.simState;
        const isRunning = simState == pxt.editor.SimState.Running;
        const isStarting = simState == pxt.editor.SimState.Starting;
        const isDebugging = parentState.debugging;
        if (!isDebugging) return <div />;

        const isDebuggerRunning = simulator.driver && simulator.driver.state == pxsim.SimulatorState.Running;
        const advancedDebugging = !this.props.parent.isBlocksActive();

        const isValidDebugFile = advancedDebugging || this.props.parent.isBlocksActive() || pxt.appTarget.appTheme.debugExtensionCode;
        if (!isValidDebugFile) return <div />;

        const dbgStepDisabled = isDebuggerRunning || isStarting;
        const dbgStepDisabledClass = dbgStepDisabled ? "disabled" : ""

        const restartTooltip = lf("Restart debugging");
        const dbgPauseResumeTooltip = isRunning ? lf("Pause execution") : lf("Continue execution");
        const dbgStepIntoTooltip = lf("Step into");
        const dbgStepOverTooltip = lf("Step over");
        const dbgStepOutTooltip = lf("Step out");

        const tracing = this.props.parent.state.tracing;
        const traceTooltip = tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo")

        if (!isDebugging) {
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")} />
        } else if (advancedDebugging) {
            // Debugger Toolbar for the monaco editor.
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")}>
                {!isDebugging ? undefined :
                    <div className={`ui compact borderless menu icon`}>
                        <sui.Item key='dbgpauseresume' className={`dbg-btn dbg-pause-resume ${dbgStepDisabledClass} ${isDebuggerRunning ? "pause" : "play"}`} icon={`${isDebuggerRunning ? "pause blue" : "play green"}`} title={dbgPauseResumeTooltip} onClick={this.dbgPauseResume} />
                        <sui.Item key='dbgstepover' className={`dbg-btn dbg-step-over ${dbgStepDisabledClass}`} icon={`xicon stepover ${isDebuggerRunning ? "disabled" : "blue"}`} title={dbgStepOverTooltip} onClick={this.dbgStepOver} />
                        <sui.Item key='dbgstepinto' className={`dbg-btn dbg-step-into ${dbgStepDisabledClass}`} icon={`xicon stepinto ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} />
                        <sui.Item key='dbgstepout' className={`dbg-btn dbg-step-out ${dbgStepDisabledClass}`} icon={`xicon stepout ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepOutTooltip} onClick={this.dbgStepOut} />
                        <sui.Item key='dbgrestart' className={`dbg-btn dbg-restart right`} icon={`refresh green`} title={restartTooltip} onClick={this.restartSimulator} />
                        <sui.Item key='dbgslowmo' className={`dbg-btn dbg-trace ${tracing ? "tracing" : ""}`} icon={`xicon turtle`} title={traceTooltip} onClick={this.toggleTrace} />
                    </div>}
            </div>;
        } else {
            // Debugger Toolbar for the blocks editor.
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")}>
                <div className={`ui compact borderless menu icon`}>
                    <sui.Item key='dbgstep' className={`dbg-btn dbg-step separator-after ${dbgStepDisabledClass}`} icon={`arrow right ${dbgStepDisabled ? "disabled" : "blue"}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} text={"Step"} />
                    <sui.Item key='dbgpauseresume' className={`dbg-btn dbg-pause-resume ${isDebuggerRunning ? "pause" : "play"}`} icon={`${isDebuggerRunning ? "pause blue" : "play green"}`} title={dbgPauseResumeTooltip} onClick={this.dbgPauseResume} />
                    <sui.Item key='dbgrestart' className={`dbg-btn dbg-restart`} icon={`refresh green`} title={restartTooltip} onClick={this.restartSimulator} />
                    <sui.Item key='dbgslowmo' className={`dbg-btn dbg-trace ${tracing ? "tracing" : ""}`} icon={`xicon turtle`} title={traceTooltip} onClick={this.toggleTrace} />
                </div>
            </div>;
        }
    }
}