import * as React from "react";
import { DebuggerCallStack } from "./debuggerCallStack";
import { DebuggerVariables } from "./debuggerVariables";
import { DebuggerToolbar } from "./debuggerToolbar";

export interface DebuggerToolboxProps extends pxt.editor.ISettingsProps {
    apis: pxt.Map<pxtc.SymbolInfo>;

    showCallStack?: boolean;
    openLocation?: (loc: pxtc.LocationInfo) => void;
}

export interface DebuggerToolboxState {
    lastBreakpoint?: pxsim.DebuggerBreakpointMessage;
    varFilters?: string[]
}

export class DebuggerToolbox extends React.Component<DebuggerToolboxProps, DebuggerToolboxState> {
    constructor(props: DebuggerToolboxProps) {
        super(props);
        this.state = {};
    }

    render() {
        return <div>
            <DebuggerToolbar parent={this.props.parent} />
            <DebuggerVariables apis={this.props.apis} breakpoint={this.state.lastBreakpoint} filters={this.state.varFilters} />
            { this.props.showCallStack &&
                <DebuggerCallStack openLocation={this.props.openLocation} stackframes={this.state.lastBreakpoint ? this.state.lastBreakpoint.stackframes.map(sf => sf.funcInfo ) : []} /> }
        </div>
    }
}