import * as React from "react";
import * as data from "./data";
import * as simulator from "./simulator";
import { DebuggerTable, DebuggerTableRow } from "./debuggerTable";

interface DebuggerEnergyProps {
}

interface DebuggerEnergyState {

}

export class DebuggerEnergy extends data.Component<DebuggerEnergyProps, DebuggerEnergyState> {
    constructor(props: DebuggerEnergyProps) {
        super(props);
        this.state = {
            globalFrame: {
                title: lf("Globals"),
                variables: []
            },
            stackFrames: [],
            nextID: 0,
            preview: null
        };

    }

    clear() {
        // this.setState({
        //     globalFrame: {
        //         title: this.state.globalFrame.title,
        //         variables: []
        //     },
        //     stackFrames: [],
        //     preview: null
        // });
    }

    update(frozen = false) {
        // this.setState({ frozen, preview: frozen ? null : this.state.preview });
    }

    componentDidUpdate(prevProps: DebuggerEnergyProps) {

    }

    renderCore() {
        // const { globalFrame, stackFrames, frozen, preview } = this.state;
        // const { activeFrame, breakpoint } = this.props;
        // const variableTableHeader = lf("Variables");
        // let variables = globalFrame.variables;

        // // Add in the local variables.
        // // TODO: Handle callstack
        // if (stackFrames && stackFrames.length && activeFrame !== undefined) {
        //     variables = stackFrames[activeFrame].variables.concat(variables);
        // }

        // let placeholderText: string;

        // if (frozen) {
        //     placeholderText = lf("Code is running...");
        // }
        // else if (!variables.length && !breakpoint?.exceptionMessage) {
        //     placeholderText = lf("No variables to show");
        // }

        // const tableRows = placeholderText ? [] : this.renderVars(variables);

        // if (breakpoint?.exceptionMessage && !frozen) {
        //     tableRows.unshift(<DebuggerTableRow
        //         leftText={lf("Exception:")}
        //         leftClass="exception"
        //         key="exception-message"
        //         rightText={truncateLength(breakpoint.exceptionMessage)}
        //         rightTitle={breakpoint.exceptionMessage}
        //     />);
        // }

        // const previewVar = this.getVariableById(preview?.id);
        // const previewLabel = previewVar && lf("Current value for '{0}'", previewVar.name);

        return <div>
            <DebuggerTable header={undefined} placeholderText={undefined}>
                {undefined}
            </DebuggerTable>
        </div>
    }

    protected handleComponentClick = (e: React.SyntheticEvent<HTMLDivElement>, component: DebuggerTableRow) => {
        // if (this.state.frozen) return;

        // const variable = this.getVariableById(component.props.refID as number);

        // if (variable) {
        //     this.toggle(variable);

        //     if (this.state.preview !== null) {
        //         this.setState({
        //             preview: null
        //         });
        //     }
        // }
    }

    protected handleValueClick = (e: React.SyntheticEvent<HTMLDivElement>, component: DebuggerTableRow) => {
        // if (this.state.frozen) return;

        // const id = component.props.refID;
        // const bb = (e.target as HTMLDivElement).getBoundingClientRect();
        // this.setState({
        //     preview: {
        //         id: id as number,
        //         top: bb.top,
        //         left: bb.left
        //     }
        // });
    }

}
