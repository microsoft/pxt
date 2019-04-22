import * as React from "react";
import { DebuggerCallStack } from "./debuggerCallStack";
import { DebuggerVariables } from "./debuggerVariables";
import { DebuggerToolbar } from "./debuggerToolbar";

export interface DebuggerToolboxProps extends pxt.editor.ISettingsProps {
    apis: pxt.Map<pxtc.SymbolInfo>;

    showCallStack?: boolean;
    openLocation?: (breakpoint: number) => void;
}

export interface DebuggerToolboxState {
    lastBreakpoint?: pxsim.DebuggerBreakpointMessage;
    currentFrame?: number;
    varFilters?: string[]
}

export class DebuggerToolbox extends React.Component<DebuggerToolboxProps, DebuggerToolboxState> {
    constructor(props: DebuggerToolboxProps) {
        super(props);
        this.state = {};
    }

    setActiveFrame(breakpoint: number) {
        if (this.state.lastBreakpoint) {
            for (let i = 0; i < this.state.lastBreakpoint.stackframes.length; i++) {
                if (this.state.lastBreakpoint.stackframes[i].breakpointId === breakpoint) {
                    this.setState({
                        currentFrame: i
                    });
                    return;
                }
            }
        }
    }

    render() {
        return <div>
            <DebuggerToolbar parent={this.props.parent} />
            <DebuggerVariables apis={this.props.apis} breakpoint={this.state.lastBreakpoint} filters={this.state.varFilters} activeFrame={this.state.currentFrame} />
            { this.props.showCallStack &&
                <DebuggerCallStack openLocation={this.props.openLocation} activeFrame={this.state.currentFrame} stackframes={this.state.lastBreakpoint ? this.state.lastBreakpoint.stackframes : []}  /> }
        </div>
    }
}