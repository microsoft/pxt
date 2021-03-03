import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { ActionButtons } from './ActionButtons';

import { ActivityStatus, isActivityUnlocked, isMapUnlocked, lookupActivityProgress, } from '../lib/skillMapUtils';

/* tslint:disable:no-import-side-effect */
import '../styles/infopanel.css'
/* tslint:enable:no-import-side-effect */

interface InfoPanelProps {
    mapId: string;
    title: string;
    description: string;
    imageUrl?: string;
    progressText?: string;
    activity?: MapActivity;
    status?: ActivityStatus;
}

export class InfoPanelImpl extends React.Component<InfoPanelProps> {
    render() {
        const  { mapId, title, description, imageUrl, progressText, activity, status  } = this.props;
        return <div className="info-panel">
            <div className="info-panel-image">
                {imageUrl
                ? <img src={imageUrl} alt={lf("Preview of activity content")} />
                : <i className={`icon image`} />}
            </div>
            <div className="info-panel-title">{title}</div>
            <div className="info-panel-description">{description}</div>
            {activity?.tags && activity.tags.length > 0 && <div className="info-panel-tags">
                {activity.tags.map((el, i) => <div key={i}>{el}</div>)}
            </div>}
            {activity && <div className="info-panel-detail">
                <div>{progressText}</div>
                <div>{activity.type}</div>
            </div>}
            {activity && <ActionButtons mapId={mapId} activityId={activity.activityId} status={status} />}
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const item = state.selectedItem;
    let status: ActivityStatus | undefined;
    let currentStep: number | undefined;
    let maxSteps: number | undefined;

    if (item) {
        const map = state.maps?.[item.mapId];
        const isUnlocked = state.user && map && isActivityUnlocked(state.user, state.pageSourceUrl, map, item.activityId);

        status = isUnlocked ? "notstarted" : "locked";
        if (state.user) {
            if (map && state.pageSourceUrl && !isMapUnlocked(state.user, map, state.pageSourceUrl)) {
                status = "locked";
            }
            else {
                const progress = lookupActivityProgress(state.user, state.pageSourceUrl, item.mapId, item.activityId);

                if (progress) {
                    if (progress.isCompleted) {
                        status = (progress.currentStep && progress.maxSteps && progress.currentStep < progress.maxSteps) ?
                            "restarted" : "completed";
                    }
                    else if (progress.headerId) {
                        status = "inprogress";
                    }
                    currentStep = progress?.currentStep;
                    maxSteps = progress?.maxSteps;
                }
            }
        }
    }

    const node = item && state.maps[item.mapId]?.activities[item.activityId];
    const isActivity = node?.kind === "activity";
    return {
        mapId: item?.mapId,
        title: node ? node.displayName : state.title,
        description: isActivity ? (node as MapActivity).description : state.description,
        imageUrl: node ? node.imageUrl : undefined,
        activity: isActivity ? node : undefined,
        status,
        progressText: maxSteps ? `${currentStep}/${maxSteps} ${lf("Steps")}` : lf("Not Started")
    };
}

export const InfoPanel = connect(mapStateToProps)(InfoPanelImpl);