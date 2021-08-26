import * as React from "react";
import { connect } from 'react-redux';
import { dispatchShowLoginModal } from "../actions/dispatch";
import { SkillMapState } from "../store/reducer";
import { lookupActivityProgress } from "../lib/skillMapUtils";
import { head } from "request";

interface OwnProps {
    signedIn: boolean;
    cloudStatus: pxt.cloud.CloudStatus;
}

interface DispatchProps {
    dispatchShowLoginModal: () => void;
}

type CloudActionsProps = OwnProps & DispatchProps;

export class CloudActionsImpl extends React.Component<CloudActionsProps> {
    render () {
        const cloudStatus = pxt.cloud.cloudStatus[this.props.cloudStatus];
        return <div className="cloud-action">
            {
                this.props.signedIn
                ? <div className="cloud-indicator">
                    <div className={`ui tiny cloudicon xicon ${cloudStatus.icon}`} title={cloudStatus.tooltip} tabIndex={-1}></div>
                    {cloudStatus.longStatus}
                </div>
                : <div className="sign-in-button" onClick={this.props.dispatchShowLoginModal}>
                    {lf("Sign in to Save")}
                </div>
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const { user, pageSourceUrl, selectedItem } = state;

    let cloudStatus: pxt.cloud.CloudStatus = "none";

    if (selectedItem) {
        const headerId = lookupActivityProgress(
            user,
            pageSourceUrl,
            selectedItem.mapId,
            selectedItem.activityId,
        )?.headerId;
        if (headerId) {
            cloudStatus = state.cloudState && state.cloudState[headerId] || "none";
        }
    }

    return {
        signedIn: state.auth.signedIn,
        cloudStatus
    }
}

const mapDispatchToProps = {
    dispatchShowLoginModal
}

export const CloudActions = connect(mapStateToProps, mapDispatchToProps)(CloudActionsImpl);
