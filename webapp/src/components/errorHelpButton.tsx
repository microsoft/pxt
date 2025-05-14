import * as auth from "../auth";
import { Button } from "../../../react-common/components/controls/Button";
import { classList } from "../../../react-common/components/util";
import { ErrorHelpTourResponse } from "../errorHelp";

export interface ErrorHelpButtonProps {
    parent: pxt.editor.IProjectView;
    getErrorHelp: () => void;
}

interface ErrorHelpButtonState {
    explanation?: ErrorHelpTourResponse;
    loadingHelp?: boolean;
}

export class ErrorHelpButton extends auth.Component<
    ErrorHelpButtonProps,
    ErrorHelpButtonState
> {
    constructor(props: ErrorHelpButtonProps) {
        super(props);
        this.state = {
            explanation: undefined,
            loadingHelp: false,
        };

        this.onHelpClick = this.onHelpClick.bind(this);
    }

    onHelpClick = () => {
        this.setState({ loadingHelp: true });

        // Sign-in required. Prompt the user, if they are logged out.
        if (!this.isLoggedIn()) {
            this.props.parent.showLoginDialog(undefined, {
                signInMessage: lf("Sign-in is required to use this feature"),
                signUpMessage: lf("Sign-up is required to use this feature"),
            });
            return;
        }

        this.props.getErrorHelp();
    }

    renderCore() {
        if (!pxt.auth.hasIdentity()) {
            return null;
        }

        const { loadingHelp } = this.state;

        // if (loadingHelp) {
        //     return <div className="common-spinner" />;
        // }

        return (
            <Button
                id="error-help-button"
                onClick={this.onHelpClick}
                title={lf("Help me understand")}
                className={classList("secondary", "error-help-button")}
                label={lf("Help me understand")}
                leftIcon="fas fa-robot"
            />
        );
    }
}