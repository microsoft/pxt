import * as React from "react";
import { getKeyForFrame } from "./debuggerVariables";
import { DebuggerTable, DebuggerTableRow } from "./debuggerTable";


export interface DebuggerCallStackProps {
    stackframes: pxtc.FunctionLocationInfo[];
    activeFrame?: number;
    openLocation?: (loc: pxtc.LocationInfo) => void;
}

export interface DebuggerCallStackState {
    activeFrame: number;
}

export class DebuggerCallStack extends React.Component<DebuggerCallStackProps, DebuggerCallStackState> {
    constructor(props: DebuggerCallStackProps) {
        super(props);
        this.state = {
            activeFrame: props.activeFrame || 0
        };
    }

    render() {
        return (
            <DebuggerTable header={lf("Call Stack")}>
                {this.props.stackframes.map((funcInfo, index) =>
                    <DebuggerTableRow key={getKeyForFrame(funcInfo)}
                        refID={getKeyForFrame(funcInfo)}
                        leftText={funcInfo.functionName}
                        rightText={`${funcInfo.fileName}:${funcInfo.line}`}
                        icon={index === this.state.activeFrame ? "arrow right" : undefined} />
                )}
            </DebuggerTable>
        );
    }

    protected handleComponentClick = (e: React.SyntheticEvent<HTMLDivElement>, component: DebuggerTableRow) => {
        if (!this.props.openLocation) return;

        const stackFrame = this.props.stackframes.filter(sf => getKeyForFrame(sf) === component.props.refID)[0];

        if (stackFrame) {
            this.props.openLocation(stackFrame);
            this.setState({ activeFrame: this.props.stackframes.indexOf(stackFrame) });
        }
    }
}

