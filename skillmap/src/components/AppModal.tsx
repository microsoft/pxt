/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { ModalType, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchRestartActivity, dispatchOpenActivity, dispatchResetUser, dispatchSetReloadHeaderState } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync } from "../lib/browserUtils";

import { Modal, ModalAction } from './Modal';
import { carryoverProjectCode } from "../lib/codeCarryover";

type CompletionModalType = "map" | "activity";

interface AppModalProps {
    type: ModalType;
    completionType?: CompletionModalType;
    skillMap?: SkillMap;
    userState?: UserState;
    mapId: string;
    activity?: MapActivity;
    nextActivityId?: string;
    pageSourceUrl?: string;
    displayName?: string;
    actions?: ModalAction[];
    dispatchHideModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string) => void;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchResetUser: () => void;
    dispatchSetReloadHeaderState: (state: "reload" | "reloading" | "active") => void;
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
            case "reset":
                return this.renderResetWarning();
            case "carryover":
                return this.renderCodeCarryoverModal();
            default:
                return <div/>
        }
    }

    protected handleOnClose = () => {
        this.props.dispatchHideModal();
    }

    renderCompletionModal() {
        const  { type, displayName, completionType, actions } = this.props;
        if (!type) return <div />

        const completionModalTitle = completionType === "activity" ? lf("Activity Complete!") : lf("Path Complete!");
        const completionModalText = lf("Good work! You've completed {0}. Collect your certificate and keep going!", "{0}");
        const completionModalTextSegments = completionModalText.split("{0}");

        const density = 100;

        return <div className="confetti-container">
            <Modal title={completionModalTitle} actions={actions} onClose={this.handleOnClose}>
                {completionModalTextSegments[0]}{<strong>{displayName}</strong>}{completionModalTextSegments[1]}
            </Modal>
            {Array(density).fill(0).map((el, i) => {
                const style = {
                    animationDelay: `${0.1 * (i % density)}s`,
                    left: `${1 * (Math.floor(Math.random() * density))}%`
                }
                return <div key={i} style={style} className={`confetti ${Math.random() > 0.5 ? "reverse" : ""} color-${Math.floor(Math.random() * 9)}`} />
            })}
        </div>
    }

    renderRestartWarning() {
        const  { mapId, activity, dispatchRestartActivity } = this.props;
        const restartModalTitle = lf("Restart Activity?");
        const restartModalText = lf("Are you sure you want to restart {0}? You won't lose your path progress but the code have written for this activity will be deleted.", "{0}");
        const restartModalTextSegments = restartModalText.split("{0}");

        const actions = [
            { label: lf("CANCEL"), onClick: this.handleOnClose },
            { label: lf("RESTART"), onClick: () => {
                tickEvent("skillmap.activity.restart", { path: mapId, activity: activity!.activityId });
                dispatchRestartActivity(mapId, activity!.activityId);
            }}
        ]

        return <Modal title={restartModalTitle} actions={actions} onClose={this.handleOnClose}>
            {restartModalTextSegments[0]}{<strong>{activity!.displayName}</strong>}{restartModalTextSegments[1]}
        </Modal>
    }

    renderResetWarning() {
        const  { dispatchResetUser, dispatchHideModal } = this.props;
        const resetModalTitle = lf("Reset All Activities?");
        const resetModalText = lf("Are you sure you want to reset? This will permanently erase all progress and delete the project created for each tutorial. This action cannot be undone.");

        const actions = [
            { label: lf("CANCEL"), onClick: this.handleOnClose },
            { label: lf("RESET"), onClick: () => {
                tickEvent("skillmap.reset");
                dispatchResetUser();
                dispatchHideModal();
            }}
        ]

        return <Modal title={resetModalTitle} actions={actions} onClose={this.handleOnClose}>
            {resetModalText}
        </Modal>
    }

    renderReportAbuse() {
        const  { pageSourceUrl, dispatchHideModal } = this.props;
        const abuseModalTitle = "Report Abuse";
        const abuseModalText = "Describe the content and explain why you are reporting it for abuse. Provide as much detail as possible!";

        const actions = [
            { label: "REPORT", onClick: () => {
                tickEvent("skillmap.reportabuse");
                postAbuseReportAsync(pageSourceUrl || "", { text: (document.querySelector(".report-abuse-text") as HTMLTextAreaElement).value });
                dispatchHideModal();
            }}
        ]

        return <Modal title={abuseModalTitle} actions={actions} onClose={this.handleOnClose}>
            <textarea className="report-abuse-text" placeholder={abuseModalText} />
        </Modal>
    }

    renderCodeCarryoverModal() {
        const  { dispatchHideModal, skillMap, activity, pageSourceUrl, userState, dispatchSetReloadHeaderState } = this.props;
        const carryoverModalTitle = lf("Keep code from previous activity?");
        const carryoverModalText = lf("Do you want to start with your code from the previous activity or start fresh with some starter code?");

        const actions = [
            { label: lf("START FRESH"), onClick: async () => {
                tickEvent("skillmap.startfresh");

                dispatchSetReloadHeaderState("reloading")

                await carryoverProjectCode(userState!, pageSourceUrl!, skillMap!, activity!.activityId, false)

                dispatchSetReloadHeaderState("reload");
                dispatchHideModal();
            } },
            { label: lf("KEEP CODE"), onClick: async () => {
                tickEvent("skillmap.keepcode");

                dispatchSetReloadHeaderState("reloading")

                await carryoverProjectCode(userState!, pageSourceUrl!, skillMap!, activity!.activityId, true)

                dispatchSetReloadHeaderState("reload");
                dispatchHideModal();
            } }
        ]

        return <Modal title={carryoverModalTitle} actions={actions} onClose={this.handleOnClose}>
            {carryoverModalText}
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

    if (currentMapId && type !== "restart-warning") {
        const map = state.maps[currentMapId];
        if (currentActivityId) {
            const activity = map.activities[currentActivityId];
            completionType = "activity";
            displayName = activity.displayName;
            nextActivityId = activity.next?.[0]?.activityId;

            actions.push({ label: lf("NEXT"), onClick: () => {
                tickEvent("skillmap.activity.next", { path: currentMapId, activity: currentActivityId });
                dispatchHideModal();
                dispatchOpenActivity(currentMapId, nextActivityId || "");
             } });
        } else {
            completionType = "map";
            displayName = map.displayName;

            actions.push({ label: lf("CERTIFICATE"), onClick: () => {
                tickEvent("skillmap.certificate", { path: currentMapId });
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
        skillMap: state.editorView ? state.maps[state.editorView.currentMapId] : undefined,
        userState: state.user,

        mapId: currentMapId,
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined
    }
}

const mapDispatchToProps = {
    dispatchHideModal,
    dispatchRestartActivity,
    dispatchOpenActivity,
    dispatchResetUser,
    dispatchSetReloadHeaderState
};

export const AppModal = connect(mapStateToProps, mapDispatchToProps)(AppModalImpl);
