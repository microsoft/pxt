/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { ModalType, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchRestartActivity, dispatchOpenActivity } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync } from "../lib/browserUtils";

import { Modal, ModalAction } from './Modal';

type CompletionModalType = "map" | "activity";

interface AppModalProps {
    type: ModalType;
    completionType?: CompletionModalType;
    mapId: string;
    activity?: MapActivity;
    nextActivityId?: string;
    pageSourceUrl?: string;
    displayName?: string;
    actions?: ModalAction[];
    dispatchHideModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string) => void;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
}

export class AppModalImpl extends React.Component<AppModalProps> {
    render() {
        const  { activity, type, completionType } = this.props;

        switch (type) {
            case "completion":
                if (!activity && completionType !== "map") return <div />
                return this.renderCompletionModal();
            case "restart-warning":
                if (!activity) return <div />
                return this.renderRestartWarning();
            case "report-abuse":
                return this.renderReportAbuse();
            default:
                return <div/>
        }
    }

    renderCompletionModal() {
        const  { type, displayName, dispatchHideModal, completionType, actions } = this.props;
        if (!type) return <div />

        const completionModalTitle = completionType === "activity" ? "Activity Complete!" : "Path Complete!";
        const completionModalText = "Good work! You've completed {0}. Keep going!";
        const completionModalTextSegments = completionModalText.split("{0}");

        return <Modal title={completionModalTitle} actions={actions} onClose={() => dispatchHideModal()}>
            {completionModalTextSegments[0]}{<strong>{displayName}</strong>}{completionModalTextSegments[1]}
        </Modal>
    }

    renderRestartWarning() {
        const  { mapId, activity, dispatchHideModal, dispatchRestartActivity } = this.props;
        const restartModalTitle = "Restart Activity?";
        const restartModalText = "Are you sure you want to restart {0}? You won't lose your map progress but any code you wrote will be deleted.";
        const restartModalTextSegments = restartModalText.split("{0}");

        const actions = [
            { label: "CANCEL", onClick: () => dispatchHideModal() },
            { label: "RESTART", onClick: () => {
                tickEvent("skillmap.activity.restart", { map: mapId, activity: activity!.activityId });
                dispatchRestartActivity(mapId, activity!.activityId);
            }}
        ]

        return <Modal title={restartModalTitle} actions={actions} onClose={() => dispatchHideModal()}>
            {restartModalTextSegments[0]}{<strong>{activity!.displayName}</strong>}{restartModalTextSegments[1]}
        </Modal>
    }

    renderReportAbuse() {
        const  { pageSourceUrl, dispatchHideModal } = this.props;
        const abuseModalTitle = "Report Abuse";
        const abuseModalText = "Describe the content and explain why you are reporting it for abuse. Provide as much detail as possible!";

        const actions = [
            { label: "REPORT", onClick: () => {
                postAbuseReportAsync(pageSourceUrl || "", { text: (document.querySelector(".report-abuse-text") as HTMLTextAreaElement).value });
                dispatchHideModal();
            }}
        ]

        return <Modal title={abuseModalTitle} actions={actions} onClose={() => dispatchHideModal()}>
            <textarea className="report-abuse-text" placeholder={abuseModalText} />
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { pageSourceUrl } = state;
    const { currentMapId, currentActivityId, type } = state.modal || {};
    let nextActivityId: string | undefined;
    let displayName: string | undefined;
    let completionType: CompletionModalType | undefined;
    let actions: ModalAction[] = [];

    if (currentMapId) {
        const map = state.maps[currentMapId];
        if (currentActivityId) {
            const activity = map.activities[currentActivityId];
            completionType = "activity";
            displayName = activity.displayName;
            nextActivityId = activity.next?.[0].activityId;

            actions.push({ label:"NEXT", onClick: () => {
                tickEvent("skillmap.activity.next", { map: currentMapId, activity: currentActivityId });
                dispatchHideModal();
                dispatchOpenActivity(currentMapId, nextActivityId || "");
             } });
        } else {
            completionType = "map";
            displayName = map.displayName;

            actions.push({ label: "CERTIFICATE", onClick: () => {
                tickEvent("skillmap.certificate", { map: currentMapId });
                window.open(map.completionUrl)
            }});
        }
    }

    return {
        type,
        completionType,
        displayName,
        nextActivityId,
        pageSourceUrl,
        actions,

        mapId: currentMapId,
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined
    }
}

const mapDispatchToProps = {
    dispatchHideModal,
    dispatchRestartActivity,
    dispatchOpenActivity
};

export const AppModal = connect(mapStateToProps, mapDispatchToProps)(AppModalImpl);
