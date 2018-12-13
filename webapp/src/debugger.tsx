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
}

export class DebuggerVariables extends data.Component<DebuggerVariablesProps, DebuggerVariablesState> {

    private static MAX_VARIABLE_CHARS = 20;

    private nextVariables: pxt.Map<pxsim.Variables> = {};

    constructor(props: DebuggerVariablesProps) {
        super(props);
        this.state = {
            variables: {}
        }
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
        return DebuggerVariables.capLength(sv);
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
        if (v.children) {
            delete v.children;
            this.setState({ variables: this.state.variables })
        } else {
            if (!v.value.id) return;
            simulator.driver.variablesAsync(v.value.id)
                .then((msg: pxsim.VariablesMessage) => {
                    if (msg) {
                        v.children = pxt.Util.mapMap(msg.variables || {},
                            (k, v) => {
                                return {
                                    value: msg.variables[k]
                                }
                            });
                        this.setState({ variables: this.state.variables })
                    }
                })
        }
    }

    private renderVariables(variables: pxt.Map<Variable>, parent?: string): JSX.Element[] {
        const varcolor = pxt.toolbox.getNamespaceColor('variables');
        let r: JSX.Element[] = []
        Object.keys(variables).forEach(variable => {
            const v = variables[variable];
            const onClick = v.value && v.value.id ? () => this.toggle(v) : undefined;
            r.push(<div key={(parent || "") + variable} className="item">
                <div role="listitem" className={`ui label image variable ${v.prevValue !== undefined ? "changed" : ""}`} style={{ backgroundColor: varcolor }}
                    onClick={onClick}>
                    <span className="varname">{variable}</span>
                    <div className="detail">
                        <span className="varval">{DebuggerVariables.renderValue(v.value)}</span>
                        <span className="previousval">{v.prevValue !== undefined ? `${DebuggerVariables.renderValue(v.prevValue)}` : ''}</span>
                    </div>
                </div>
            </div>);
            if (v.children)
                r = r.concat(this.renderVariables(v.children, variable));
        })
        return r;
    }

    renderCore() {
        const { variables, frozen } = this.state;

        return Object.keys(variables).length == 0 ? <div /> :
            <div className={`ui segment debugvariables ${frozen ? "frozen" : ""}`}>
                <div className="ui middle aligned list">
                    {this.renderVariables(variables)}
                </div>
            </div>;
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

        this.toolbarHandleDown = this.toolbarHandleDown.bind(this);
        this.restartSimulator = this.restartSimulator.bind(this);
        this.dbgPauseResume = this.dbgPauseResume.bind(this);
        this.dbgInsertBreakpoint = this.dbgInsertBreakpoint.bind(this);
        this.dbgStepOver = this.dbgStepOver.bind(this);
        this.dbgStepInto = this.dbgStepInto.bind(this);
        this.dbgStepOut = this.dbgStepOut.bind(this);
    }

    restartSimulator() {
        pxt.tickEvent('debugger.restart', undefined, { interactiveConsent: true });
        this.props.parent.restartSimulator(true);
    }

    exitDebugging() {
        pxt.tickEvent('debugger.exit', undefined, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    dbgPauseResume() {
        pxt.tickEvent('debugger.pauseresume', undefined, { interactiveConsent: true });
        this.props.parent.dbgPauseResume();
    }

    dbgInsertBreakpoint() {
        pxt.tickEvent('debugger.breakpoint', undefined, { interactiveConsent: true });
        this.props.parent.dbgInsertBreakpoint();
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

    componentDidUpdate(props: DebuggerToolbarProps, state: DebuggerToolbarState) {
        if (this.state.isDragging && !state.isDragging) {
            document.addEventListener('mousemove', this.toolbarHandleMove.bind(this));
            document.addEventListener('mouseup', this.toolbarHandleUp.bind(this));
        } else if (!this.state.isDragging && state.isDragging) {
            document.removeEventListener('mousemove', this.toolbarHandleMove.bind(this));
            document.removeEventListener('mouseup', this.toolbarHandleUp.bind(this));
        }

        // Center the component if it hasn't been initialized yet
        if (state.xPos == undefined && props.parent.state.debugging) {
            this.centerToolbar();
            window.addEventListener('resize', this.centerToolbar.bind(this));
        }
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.toolbarHandleMove.bind(this));
        document.removeEventListener('mouseup', this.toolbarHandleUp.bind(this));
        window.removeEventListener('resize', this.centerToolbar.bind(this));
    }

    private cachedMaxWidth = 0;

    toolbarHandleDown(e: React.MouseEvent<any>) {
        if (e.button !== 0) return
        const menuDOM = this.getMenuDom();
        const menuWidth = menuDOM && menuDOM.clientWidth || 0;
        this.cachedMaxWidth = window.innerWidth - menuWidth;
        this.setState({
            isDragging: true,
            xPos: Math.min(e.pageX, this.cachedMaxWidth)
        })
        e.stopPropagation();
        e.preventDefault();
    }

    toolbarHandleMove(e: MouseEvent) {
        if (!this.state.isDragging) return;
        this.setState({
            isDragging: true,
            xPos: Math.min(e.pageX, this.cachedMaxWidth)
        })
        e.stopPropagation();
        e.preventDefault();
    }

    toolbarHandleUp(e: MouseEvent) {
        this.setState({ isDragging: false });
        e.stopPropagation();
        e.preventDefault();
    }

    getMenuDom() {
        const node = ReactDOM.findDOMNode(this);
        return node && node.firstElementChild;
    }

    centerToolbar() {
        // Center the toolbar in the middle of the editor view (blocks / JS)
        const menuDOM = this.getMenuDom();
        const width = menuDOM && menuDOM.clientWidth;
        const mainEditor = document.getElementById('maineditor');
        const simWidth = window.innerWidth - mainEditor.clientWidth;
        this.setState({ xPos: simWidth + (mainEditor.clientWidth - width) / 2 });
    }

    renderCore() {
        const { xPos } = this.state;
        const parentState = this.props.parent.state;
        const simOpts = pxt.appTarget.simulator;

        const simState = parentState.simState;
        const isRunning = simState == pxt.editor.SimState.Running;
        const isDebugging = parentState.debugging;
        if (!isDebugging) return <div />;

        const isDebuggerRunning = simulator.driver && simulator.driver.state == pxsim.SimulatorState.Running;
        const advancedDebugging = this.props.parent.isJavaScriptActive();

        const isValidDebugFile = advancedDebugging || this.props.parent.isBlocksActive();
        if (!isValidDebugFile) return <div />;

        const restartTooltip = lf("Restart debugging");
        const dbgPauseResumeTooltip = isRunning ? lf("Pause execution") : lf("Continue execution");
        const dbgStepIntoTooltip = lf("Step into");
        const dbgStepOverTooltip = lf("Step over");
        const dbgStepOutTooltip = lf("Step out");

        return <aside className="debugtoolbar" style={{ left: xPos }} role="complementary" aria-label={lf("Debugger toolbar")}>
            {!isDebugging ? undefined :
                <div className={`ui compact borderless menu icon`}>
                    <div role="button" className={`ui item link dbg-btn dbg-handle`} key={'toolbarhandle'}
                        title={lf("Debugger buttons")}
                        onMouseDown={this.toolbarHandleDown}>
                        <sui.Icon key='iconkey' icon={`icon ellipsis vertical`} />
                        <sui.Icon key='iconkey2' icon={`xicon bug`} />
                    </div>
                    <sui.Item key='dbgpauseresume' className={`dbg-btn dbg-pause-resume ${isDebuggerRunning ? "pause" : "play"}`} icon={`${isDebuggerRunning ? "pause blue" : "step forward green"}`} title={dbgPauseResumeTooltip} onClick={this.dbgPauseResume} />
                    <sui.Item key='dbgbreakpoint' className={`dbg-btn dbg-breakpoint`} icon="circle red" title={lf("Insert debugger breakpoint")} onClick={this.dbgInsertBreakpoint} />
                    {!advancedDebugging ? <sui.Item key='dbgstep' className={`dbg-btn dbg-step`} icon={`arrow right ${isDebuggerRunning ? "disabled" : "blue"}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} /> : undefined}
                    {advancedDebugging ? <sui.Item key='dbgstepover' className={`dbg-btn dbg-step-over`} icon={`xicon stepover ${isDebuggerRunning ? "disabled" : "blue"}`} title={dbgStepOverTooltip} onClick={this.dbgStepOver} /> : undefined}
                    {advancedDebugging ? <sui.Item key='dbgstepinto' className={`dbg-btn dbg-step-into`} icon={`xicon stepinto ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepIntoTooltip} onClick={this.dbgStepInto} /> : undefined}
                    {advancedDebugging ? <sui.Item key='dbgstepout' className={`dbg-btn dbg-step-out`} icon={`xicon stepout ${isDebuggerRunning ? "disabled" : ""}`} title={dbgStepOutTooltip} onClick={this.dbgStepOut} /> : undefined}
                    <sui.Item key='dbgrestart' className={`dbg-btn dbg-restart right`} icon={`refresh green`} title={restartTooltip} onClick={this.restartSimulator} />
                </div>}
        </aside>;
    }
}