import * as React from "react";
import { DebuggerCallStack } from "./debuggerCallStack";
import { DebuggerVariables } from "./debuggerVariables";
import { DebuggerToolbar } from "./debuggerToolbar";

import ISettingsProps = pxt.editor.ISettingsProps;

export interface DebuggerToolboxProps extends ISettingsProps {
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

    private toolbarRef = React.createRef<DebuggerToolbar>();

    constructor(props: DebuggerToolboxProps) {
        super(props);
        this.state = {
            sequence: 0,
            currentFrame: 0
        };
    }

    focus() {
        this.toolbarRef.current?.focus();
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
            <DebuggerToolbar ref={this.toolbarRef} parent={this.props.parent} showAdvancedControls={this.props.showCallStack} />
            <DebuggerVariables
                apis={this.props.apis}
                breakpoint={this.state.lastBreakpoint}
                filters={this.state.varFilters}
                activeFrame={this.state.currentFrame}
                includeAllVariables={this.props.showCallStack}
                sequence={this.state.sequence} />
            { this.props.showCallStack &&
                <DebuggerCallStack openLocation={this.props.openLocation} activeFrame={this.state.currentFrame} stackframes={this.state.lastBreakpoint ? this.state.lastBreakpoint.stackframes : []}  /> }
        </div>
    }
}