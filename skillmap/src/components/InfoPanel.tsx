import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { ActivityActions } from './ActivityActions';
import { RewardActions } from './RewardActions';
import { CloudStatus } from "./CloudStatus";
import { dispatchShowLoginModal } from '../actions/dispatch';


import { FocusTrap } from "../../../react-common/components/controls/FocusTrap";


import { ActivityStatus, isActivityCompleted, getActivityStatus, isRewardNode } from '../lib/skillMapUtils';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/infopanel.css'
import { Button } from "../../../react-common/components/controls/Button";
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface InfoPanelProps {
    mapId: string;
    title: string;
    subtitle?: string;
    description: string;
    infoUrl?: string;
    imageUrl?: string;
    details?: string[];
    node?: MapNode;
    status?: ActivityStatus;
    completedHeaderId?: string;
    onFocusEscape: () => void;
    dispatchShowLoginModal: () => void;
    signedIn: boolean;
}

export class InfoPanelImpl extends React.Component<InfoPanelProps> {
    protected container: HTMLDivElement | undefined;

    protected getStatusLabel(status?: ActivityStatus) {
        switch (status) {
            case "locked":
                return lf("Locked");
            case "completed":
                return lf("Completed");
            default:
                return null;
        }
    }

    protected getStatusIcon(status?: ActivityStatus) {
        switch (status) {
            case "locked":
                return "fas fa-lock";
            case "completed":
                return "fas fa-check-circle";
            default:
                return "";
        }
    }

    protected handleRef = (ref: HTMLDivElement) => {
        if (!ref) return;
        this.container = ref;
    }

    componentDidUpdate(prevProps: InfoPanelProps) {
        if (this.container && this.props.node?.activityId && prevProps.node?.activityId !== this.props.node?.activityId) {
            if (!this.container.contains(document.activeElement)) {
                const buttons = this.container.querySelectorAll(`button[tabindex]`);

                if (buttons.length) {
                    (buttons.item(0) as HTMLElement).focus();
                }
            }
        }
    }

    render() {
        const  { mapId, title, subtitle, description, infoUrl, imageUrl, details, node, status,
            completedHeaderId, onFocusEscape, dispatchShowLoginModal, signedIn } = this.props;
        const statusLabel = this.getStatusLabel(status);
        const isMap = !node;
        const isActivity = node && !isRewardNode(node);
        const tags = isActivity && (node as MapActivity).tags || undefined;

        const hasCloudSync = pxt.auth.hasIdentity();
        return <div className="info-panel" ref={this.handleRef}>
            <div className="info-panel-image">
                {imageUrl
                ? <img src={imageUrl} alt={lf("Preview of activity content")} />
                : <i className={`fas fa-image`} />}
            </div>
            <div className="info-panel-content">
                {subtitle && <div className="info-panel-subtitle">{subtitle}</div>}
                <div className="info-panel-title">{title}</div>
                {statusLabel && <div className="info-panel-label">
                    <i className={this.getStatusIcon(status)} />
                    <span>{statusLabel}</span>
                </div>}
                <div className="info-panel-description">{description}</div>
                {isMap && infoUrl && <a className="info-panel-link" href={infoUrl} target="_blank" rel="noopener noreferrer">{lf("Learning Outcomes")}</a>}
                {tags && tags.length > 0 && <div className="info-panel-tags">
                    {tags.map((el, i) => <div key={i}>{el}</div>)}
                </div>}
                <div className="info-panel-detail">
                    {details?.map((el, i) => <div key={`detail_${i}`}>{el}</div>)}
                </div>
                <div className="tablet-spacer" />
                <FocusTrap id="info-panel-actions" onEscape={onFocusEscape} dontStealFocus={true} arrowKeyNavigation={true} includeOutsideTabOrder={true}>
                    {!isMap && (isActivity
                        ? <ActivityActions mapId={mapId} activityId={node!.activityId} status={status} completedHeaderId={completedHeaderId} />
                        : <RewardActions mapId={mapId} activityId={node!.activityId} status={status} />)
                    }
                    {hasCloudSync && <CloudStatus />}
                </FocusTrap>
                {hasCloudSync && isMap && !signedIn &&
                    <Button
                        className="primary inverted sign-in-button"
                        onClick={dispatchShowLoginModal}
                        label={lf("Sign in to Save")}
                        title={lf("Sign in to Save")}
                    />
                }
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const { user, pageSourceUrl, maps, selectedItem, infoUrl } = state;
    const node = selectedItem && state.maps[selectedItem.mapId]?.activities[selectedItem.activityId];
    const isActivity = node?.kind === "activity";

    const details: string[] = [];
    let status: ActivityStatus | undefined;
    let subtitle: string | undefined;
    let completedHeaderId: string | undefined;

    if (maps) {
        if (selectedItem?.activityId && maps[selectedItem.mapId]) {
            const map = maps[selectedItem.mapId];
            const { status: activityStatus, currentStep, maxSteps, completedHeadedId: hid } = getActivityStatus(state.user, state.pageSourceUrl, map, selectedItem.activityId);
            status = activityStatus;
            completedHeaderId = hid;
            if (isActivity) {
                details.push(maxSteps ? `${currentStep}/${maxSteps} ${lf("Steps")}` : lf("Not Started"));
                details.push(isActivity ? (node as MapActivity).type : "");
            }
            if (map) subtitle = map.displayName
        } else if (user) {
            // Count of completed activities (not including reward nodes)
            const mapIds = Object.keys(maps);
            let completed = 0;
            let total = 0;
            let completedRewards = 0;
            let totalRewards = 0;
            mapIds.forEach(mapId => {
                const activities = maps[mapId].activities;
                const activityIds = Object.keys(activities).filter(el => activities[el].kind == "activity");
                activityIds.forEach(activityId => ++total && isActivityCompleted(user, pageSourceUrl, mapId, activityId) && ++completed);

                const rewardIds = Object.keys(activities).filter(el => isRewardNode(activities[el]));
                rewardIds.forEach(rewardId => ++totalRewards && isActivityCompleted(user, pageSourceUrl, mapId, rewardId) && ++completedRewards);
            })

            details.push(`${completed}/${total} ${lf("Complete")}`);
            details.push(totalRewards ? `${completedRewards}/${totalRewards} ${lf("Reward(s)")}` : "")
        }
    }

    return {
        mapId: selectedItem?.mapId,
        title: node?.displayName || state.title,
        subtitle,
        description: isActivity ? (node as MapActivity).description : state.description,
        infoUrl,
        imageUrl: node ? node?.imageUrl : state.bannerImageUrl,
        node,
        status,
        details,
        completedHeaderId,
        signedIn: state.auth.signedIn
    };
}

const mapDispatchToProps = {
    dispatchShowLoginModal
}

export const InfoPanel = connect(mapStateToProps, mapDispatchToProps)(InfoPanelImpl);