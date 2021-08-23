import * as React from "react";
import { connect } from 'react-redux';
import { dispatchShowLoginModal } from "../actions/dispatch";

import { SkillMapState } from "../store/reducer";

interface OwnProps {
    signedIn: boolean;
}

interface DispatchProps {
    dispatchShowLoginModal: () => void;
}

type CloudActionsProps = OwnProps & DispatchProps;

export class CloudActionsImpl extends React.Component<CloudActionsProps> {
    render () {
        return <div className="cloud-action">
            {
                this.props.signedIn
                ? <div className="cloud-indicator">
                    <div className={"ui tiny cloudicon xicon cloud-saved-b"} title={lf("Project saved to cloud")} tabIndex={-1}></div>
                    {lf("Saved To Cloud!")}
                </div>

                : <div className="sign-in-button" onClick={this.props.dispatchShowLoginModal}>
                    {lf("Sign in to Save")}
                </div>
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    return {
        signedIn: state.auth.signedIn
    }
}

const mapDispatchToProps = {
    dispatchShowLoginModal
}

export const CloudActions = connect(mapStateToProps, mapDispatchToProps)(CloudActionsImpl);