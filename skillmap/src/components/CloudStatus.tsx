import * as React from "react";
import { connect } from 'react-redux';
import { SkillMapState } from "../store/reducer";
import { lookupActivityProgress } from "../lib/skillMapUtils";

interface OwnProps {
    signedIn: boolean;
    cloudStatus: pxt.cloud.CloudStatus;
}

interface DispatchProps {
}

type CloudStatusProps = OwnProps & DispatchProps;

export class CloudStatusImpl extends React.Component<CloudStatusProps> {
    render () {
        const { cloudStatus, signedIn } = this.props;
        const cloudStatusInfo = pxt.cloud.cloudStatus[cloudStatus];

        return <div className="cloud-action">
            {
                signedIn
                ? <div className="cloud-indicator">
                    <div className={`ui tiny cloudicon xicon ${cloudStatusInfo.icon}`} title={cloudStatusInfo.tooltip}></div>
                    {cloudStatusInfo.longStatus}
                </div>
                : <div />
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const { user, pageSourceUrl, selectedItem } = state;

    let cloudStatus: pxt.cloud.CloudStatus = "none";

    if (selectedItem?.activityId) {
        const headerId = lookupActivityProgress(
            user,
            pageSourceUrl,
            selectedItem.mapId,
            selectedItem.activityId,
        )?.headerId;
        if (headerId) {
            cloudStatus = state.cloudState && state.cloudState[headerId] || cloudStatus;
        }
    } else {
        // For skillmap view, show "Saved to cloud"
        cloudStatus = "synced";
    }

    return {
        signedIn: state.auth.signedIn,
        cloudStatus
    }
}

const mapDispatchToProps = {
}

export const CloudStatus = connect(mapStateToProps, mapDispatchToProps)(CloudStatusImpl);
