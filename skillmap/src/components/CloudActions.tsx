import * as React from "react";
import { connect } from 'react-redux';
import { dispatchShowLoginModal } from "../actions/dispatch";

import { SkillMapState } from "../store/reducer";
import { getActivityStatus } from '../lib/skillMapUtils';

interface OwnProps {
    signedIn: boolean;
    headerId: string;
    cloudStatus: pxt.cloud.CloudStatus;
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
                    {this.props.cloudStatus}
                </div>

                : <div className="sign-in-button" onClick={this.props.dispatchShowLoginModal}>
                    {lf("Sign in to Save")}
                </div>
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const props = ownProps as OwnProps;
    const headerId = props.headerId;
    const cloudStatus: pxt.cloud.CloudStatus = state.cloudState ? state.cloudState[headerId] ? state.cloudState[headerId] : "none" : "none";

    return {
        signedIn: state.auth.signedIn,
        headerId,
        cloudStatus
    }
}

const mapDispatchToProps = {
    dispatchShowLoginModal
}

export const CloudActions = connect(mapStateToProps, mapDispatchToProps)(CloudActionsImpl);
