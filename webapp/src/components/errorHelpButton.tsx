import * as React from "react";
import { ErrorDisplayInfo } from "../errorList";
import { Button } from "../../../react-common/components/controls/Button";
import { classList } from "../../../react-common/components/util";
import { ErrorHelper, ErrorHelpResponse } from "../errorHelp";


// TODO thsparks - there is probably a better way to do this.

export interface ErrorHelpButtonProps {
    parent: pxt.editor.IProjectView;
    errors: ErrorDisplayInfo[];
    onHelpResponse?: (response: ErrorHelpResponse) => void;
}

interface ErrorHelpButtonState {
    explanation?: ErrorHelpResponse;
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

        this.handleHelpClick = this.handleHelpClick.bind(this);
    }

    async handleHelpClick() {
        this.setState({
            loadingHelp: true,
        });

        const helper: ErrorHelper = new ErrorHelper(this.props.parent);
        try {
            const response = await helper.getHelpAsync(this.props.errors);
            this.props.onHelpResponse?.(response);
        } catch (e) {
            // TODO thsparks - handle error
        }
    }

    render() {
        const { loadingHelp } = this.state;

        // if (loadingHelp) {
        //     return <div className="common-spinner" />;
        // }

        return (
            <Button
                id="error-help-button"
                onClick={this.handleHelpClick}
                title={lf("Help me understand")}
                className={classList("secondary", "error-help-button")}
                label={lf("Help me understand")}
                leftIcon="fas fa-robot"
            />
        );
    }
}