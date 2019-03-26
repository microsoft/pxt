import * as React from "react";
import * as ReactDOM from 'react-dom';
import * as sui from "./sui";
import * as data from "./data";
import * as simulator from "./simulator";

type ISettingsProps = pxt.editor.ISettingsProps;

interface DebuggerVariablesState {
    variables?: pxt.Map<Variable>;
    frozen?: boolean;
}

interface Variable {
    value: any;
    prevValue?: any;
    children?: pxt.Map<Variable>;
}

interface DebuggerVariablesProps extends ISettingsProps {
    apisByQName: pxt.Map<pxtc.SymbolInfo>;
}

export class DebuggerVariables extends data.Component<DebuggerVariablesProps, DebuggerVariablesState> {

    private static MAX_VARIABLE_CHARS = 20;

    private nextVariables: pxt.Map<pxsim.Variables> = {};

    constructor(props: DebuggerVariablesProps) {
        super(props);
        this.state = {
            variables: {}
        }
        this.onMouseOverVariable = this.onMouseOverVariable.bind(this);
        this.toggleDebugging = this.toggleDebugging.bind(this);
    }

    clear() {
        this.nextVariables = {};
        this.setState({ variables: {} });
    }

    set(name: string, value: pxsim.Variables) {
        this.nextVariables[name] = value;
    }

    static renderValue(v: any): string {
        let sv = '';
        let type = typeof v;
        switch (type) {
            case "undefined": sv = "undefined"; break;
            case "number": sv = v + ""; break;
            case "boolean": sv = v + ""; break;
            case "string": sv = JSON.stringify(v); break;
            case "object":
                if (v == null) sv = "null";
                else if (v.text) sv = v.text;
                else if (v.id && v.preview) return v.preview;
                else if (v.id !== undefined) sv = "(object)"
                else sv = "(unknown)"
                break;
        }
        return sv;
    }

    static capLength(varstr: string) {
        let remaining = DebuggerVariables.MAX_VARIABLE_CHARS - 3; // acount for ...
        let hasQuotes = false;
        if (varstr.indexOf('"') == 0) {
            remaining -= 2;
            hasQuotes = true;
            varstr = varstr.substring(1, varstr.length - 1);
        }
        if (varstr.length > remaining)
            varstr = varstr.substring(0, remaining) + '...';
        if (hasQuotes) {
            varstr = '"' + varstr + '"'
        }
        return varstr;
    }

    update(frozen = false) {
        const variables = this.state.variables;
        Object.keys(this.nextVariables).forEach(k => {
            const v = this.nextVariables[k];
            variables[k] = {
                value: v,
                prevValue: v && !v.id && variables[k] && v !== variables[k].value ?
                    variables[k].value : undefined
            }
        })
        this.setState({ variables: variables, frozen });
        this.nextVariables = {};
    }

    private toggle(v: Variable) {
        // We have to take care of the logic for nested looped variables. Currently they break this implementation.
        if (v.children) {
            delete v.children;
            this.setState({ variables: this.state.variables })
        } else {
            if (!v.value.id) return;
            // We filter the getters we want to call for this variable.
            let allApis = this.props.apisByQName;
            let matcher = new RegExp("^((.+\.)?" + v.value.type + ")\.");
            let potentialKeys = Object.keys(allApis).filter(key => matcher.test(key));
            let fieldsToGet: string[] = [];
            potentialKeys.forEach(key => {
                let commentAttrs = allApis[key];
                if (!key.endsWith("@set") && commentAttrs && commentAttrs.attributes.callInDebugger) {
                    fieldsToGet.push(key);
                }
            });
            simulator.driver.variablesAsync(v.value.id, fieldsToGet)
                .then((msg: pxsim.VariablesMessage) => {
                    if (msg && msg.variables) {
                        if (v.value.type == "array") {
                            v.children = pxt.Util.mapMap(msg.variables,
                                (k, v) => {
                                    return {
                                        value: msg.variables[k]
                                    }
                                });
                        } else {
                            let children: pxt.Map<Variable> = {};
                            Object.keys(msg.variables).forEach(variableName => {
                                children[variableName] = { value: msg.variables[variableName] }
                            })
                            v.children = children;
                        }
                        this.setState({ variables: this.state.variables })
                    }
                })
        }
    }

    private variableType(variable: Variable): string {
        let val = variable.value;
        if (val == null) return "undefined";
        let type = typeof val
        switch (type) {
            case "string":
            case "number":
            case "boolean":
                return type;
            case "object":
                if (val.type) return val.type;
                if (val.preview) return val.preview;
                if (val.text) return val.text;
                return "object";
            default:
                return "unknown";
        }
    }

    private shouldShowValueOnHover(type: string): boolean {
        switch (type) {
            case "string":
            case "number":
            case "boolean":
            case "array":
                return true;
            default:
                return false;
        }
    }

    toggleDebugging(): void {
        this.props.parent.toggleDebugging();
    }

    private onMouseOverVariable(): void { };

    private renderVariables(variables: pxt.Map<Variable>, parent?: string, depth?: number): JSX.Element[] {
        let r: JSX.Element[] = [];
        let varNames = Object.keys(variables);
        if (!parent) {
            varNames = varNames.sort((var_a, var_b) => {
                return this.variableType(variables[var_a]).localeCompare(this.variableType(variables[var_b])) || var_a.toLowerCase().localeCompare(var_b.toLowerCase());
            })
        }
        depth = depth || 0;
        let margin = depth * 0.75 + 'em';
        varNames.forEach(variable => {
            const v = variables[variable];
            const oldValue = DebuggerVariables.renderValue(v.prevValue);
            const newValue = DebuggerVariables.renderValue(v.value);
            let type = this.variableType(v);
            const onClick = v.value && v.value.id ? () => this.toggle(v) : undefined;

            r.push(<tr key={(parent || "") + variable} className="item" onClick={onClick} onMouseOver={this.onMouseOverVariable}>
                <td className={`variable varname ${v.prevValue !== undefined ? "changed" : ""}`} title={variable}>
                    <i className={`${(v.children ? "down triangle icon" : "right triangle icon") + ((v.value && v.value.hasFields) ? "" : " transparent")}`} style={{ marginLeft: margin }} ></i>
                    <span>{variable + ':'}</span>
                </td>
                <td style={{ padding: 0.2 }} title={this.shouldShowValueOnHover(type) ? newValue : ""}>
                    <div className="variable detail">
                        <span className={`varval ${type}`}>{DebuggerVariables.capLength(newValue)}</span>
                        <span className="previousval">{(oldValue !== "undefined" && oldValue !== newValue) ? `${DebuggerVariables.capLength(oldValue)}` : ''}</span>
                    </div>
                </td>
            </tr>
            );
            if (v.children)
                r = r.concat(this.renderVariables(v.children, variable, depth + 1));
        })
        return r;
    }

    renderCore() {
        const { variables, frozen } = this.state;
        const variableTableHeader = lf("Variable");
        const valueTableHeader = lf("Type/Value");

        return <table className={`ui segment debugvariables ${frozen ? "frozen" : ""} ui collapsing basic striped table`}>
            <thead>
                <tr>
                    <th>{variableTableHeader}</th>
                    <th>{valueTableHeader}</th>
                </tr>
            </thead>
            <tbody>
                {(Object.keys(variables).length == 0) ? <tr /> : this.renderVariables(variables)}
            </tbody>
        </table>;
    }
}

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
        const advancedDebugging = this.props.parent.isJavaScriptActive();

        const isValidDebugFile = advancedDebugging || this.props.parent.isBlocksActive();
        if (!isValidDebugFile) return <div />;

        const dbgStepDisabled = isDebuggerRunning || isStarting;
        const dbgStepDisabledClass = dbgStepDisabled ? "disabled" : ""

        const restartTooltip = lf("Restart debugging");
        const dbgPauseResumeTooltip = isRunning ? lf("Pause execution") : lf("Continue execution");
        const dbgStepIntoTooltip = lf("Step into");
        const dbgStepOverTooltip = lf("Step over");
        const dbgStepOutTooltip = lf("Step out");
        const dbgExitTooltip = lf("Exit Debug Mode");

        if (!isDebugging) {
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")} />
        } else if (advancedDebugging) {
            // Debugger Toolbar for the monaco editor.
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")}>
                {!isDebugging ? undefined :
                    <div className={`ui compact menu icon`}>
                        <sui.Item key='dbgpauseresume' className={`dbg-btn dbg-pause-resume ${dbgStepDisabledClass} ${isDebuggerRunning ? "pause" : "play"}`} icon={`${isDebuggerRunning ? "pause blue" : "play green"}`} title={dbgPauseResumeTooltip} onClick={this.dbgPauseResume} />
                        <sui.Item key='dbgstepover' className={`dbg-btn dbg-step-over ${dbgStepDisabledClass}`} icon={`xicon stepover ${isDebuggerRunning ? "disabled" : "blue"}`} title={dbgStepOverTooltip} onClick={this.dbgStepOver} />
                        <sui.Item key='dbgstepinto' className={`dbg-btn dbg-step-into ${dbgStepDisabledClass}`} icon={`xicon stepinto ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} />
                        <sui.Item key='dbgstepout' className={`dbg-btn dbg-step-out ${dbgStepDisabledClass}`} icon={`xicon stepout ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepOutTooltip} onClick={this.dbgStepOut} />
                        <sui.Item key='dbgrestart' className={`dbg-btn dbg-restart right`} icon={`refresh green`} title={restartTooltip} onClick={this.restartSimulator} />
                    </div>}
            </div>;
        } else {
            // Debugger Toolbar for the blocks editor.
            return <div className="debugtoolbar" role="complementary" aria-label={lf("Debugger toolbar")}>
                <div className={`ui compact borderless menu icon`}>
                    <sui.Item key='dbgstep' className={`dbg-btn dbg-step separator-after ${dbgStepDisabledClass}`} icon={`arrow right ${dbgStepDisabled ? "disabled" : "blue"}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} text={"Step"} />
                    <sui.Item key='dbgpauseresume' className={`dbg-btn dbg-pause-resume ${isDebuggerRunning ? "pause" : "play"}`} icon={`${isDebuggerRunning ? "pause blue" : "play green"}`} title={dbgPauseResumeTooltip} onClick={this.dbgPauseResume} />
                    <sui.Item key='dbgrestart' className={`dbg-btn dbg-restart`} icon={`refresh green`} title={restartTooltip} onClick={this.restartSimulator} />
                </div>
            </div>;
        }
    }
}