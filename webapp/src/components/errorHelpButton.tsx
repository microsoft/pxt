import * as React from "react";
import { ErrorDisplayInfo } from "../errorList";
import { Button } from "../../../react-common/components/controls/Button";
import { classList } from "../../../react-common/components/util";
import { ErrorHelpTourResponse } from "../errorHelp";

export interface ErrorHelpButtonProps {
    parent: pxt.editor.IProjectView;
    errors: ErrorDisplayInfo[];
    getErrorHelp: () => void;
}

interface ErrorHelpButtonState {
    explanation?: ErrorHelpTourResponse;
    loadingHelp?: boolean;
}

export class ErrorHelpButton extends React.Component<
    ErrorHelpButtonProps,
    ErrorHelpButtonState
> {
    constructor(props: ErrorHelpButtonProps) {
        super(props);
        this.state = {
            explanation: undefined,
            loadingHelp: false,
        };
    }

    render() {
        const { loadingHelp } = this.state;

        // if (loadingHelp) {
        //     return <div className="common-spinner" />;
        // }

        return (
            <Button
                id="error-help-button"
                onClick={this.props.getErrorHelp}
                title={lf("Help me understand")}
                className={classList("secondary", "error-help-button")}
                label={lf("Help me understand")}
                leftIcon="fas fa-robot"
            />
        );
    }
}