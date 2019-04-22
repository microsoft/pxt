import * as React from "react";
import { getKeyForFrame } from "./debuggerVariables";
import { DebuggerTable, DebuggerTableRow } from "./debuggerTable";


export interface DebuggerCallStackProps {
    stackframes: pxsim.StackFrameInfo[];
    activeFrame?: number;
    openLocation?: (breakpoint: number) => void;
}

export interface DebuggerCallStackState {
}

export class DebuggerCallStack extends React.Component<DebuggerCallStackProps, DebuggerCallStackState> {
    constructor(props: DebuggerCallStackProps) {
        super(props);
    }

    render() {
        return (
            <DebuggerTable header={lf("Call Stack")}>
                {this.props.stackframes.map((sf, index) =>
                    <DebuggerTableRow key={getKeyForFrame(sf.funcInfo)}
                        refID={getKeyForFrame(sf.funcInfo)}
                        onClick={this.handleRowClick}
                        leftText={sf.funcInfo.functionName}
                        rightText={`${sf.funcInfo.fileName}:${sf.funcInfo.line}`}
                        icon={index === this.props.activeFrame ? "arrow right" : undefined} />
                )}
            </DebuggerTable>
        );
    }

    protected handleRowClick = (e: React.SyntheticEvent<HTMLDivElement>, component: DebuggerTableRow) => {
        if (!this.props.openLocation) return;

        const stackFrame = this.props.stackframes.filter(sf => getKeyForFrame(sf.funcInfo) === component.props.refID)[0];

        if (stackFrame) {
            this.props.openLocation(stackFrame.breakpointId);
            this.setState({ activeFrame: this.props.stackframes.indexOf(stackFrame) });
        }
    }
}

