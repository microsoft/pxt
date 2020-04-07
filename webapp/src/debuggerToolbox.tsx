import * as React from "react";
import { DebuggerCallStack } from "./debuggerCallStack";
import { DebuggerVariables } from "./debuggerVariables";
import { DebuggerToolbar } from "./debuggerToolbar";

export interface DebuggerToolboxProps extends pxt.editor.ISettingsProps {
    apis: pxt.Map<pxtc.SymbolInfo>;

    showCallStack?: boolean;
    openLocation?: (breakpoint: number, frameIndex: number) => void;
}

export interface DebuggerToolboxState {
    sequence: number;
    lastBreakpoint?: pxsim.DebuggerBreakpointMessage;
    currentFrame?: number;
    varFilters?: string[]
}

export class DebuggerToolbox extends React.Component<DebuggerToolboxProps, DebuggerToolboxState> {
    constructor(props: DebuggerToolboxProps) {
        super(props);
        this.state = {
            sequence: 0,
            currentFrame: 0
        };
    }

    setBreakpoint(bp: pxsim.DebuggerBreakpointMessage, varFilters?: string[]) {
        this.setState({
            lastBreakpoint: bp,
            currentFrame: 0,
            sequence: this.state.sequence + 1,
            varFilters: varFilters || this.state.varFilters
        });
    }

    render() {
        return <div>
            <DebuggerToolbar parent={this.props.parent} />
            <DebuggerVariables
                apis={this.props.apis}
                breakpoint={this.state.lastBreakpoint}
                filters={this.state.varFilters}
                activeFrame={this.state.currentFrame}
                sequence={this.state.sequence} />
            { this.props.showCallStack &&
                <DebuggerCallStack openLocation={this.props.openLocation} activeFrame={this.state.currentFrame} stackframes={this.state.lastBreakpoint ? this.state.lastBreakpoint.stackframes : []}  /> }
        </div>
    }
}