/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { ModalType, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchRestartActivity, dispatchOpenActivity, dispatchResetUser, dispatchSetReloadHeaderState } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync, postShareAsync } from "../lib/browserUtils";
import { lookupActivityProgress, lookupPreviousCompletedActivityState } from "../lib/skillMapUtils";
import { carryoverProjectCode } from "../lib/codeCarryover";
import { getProjectAsync } from "../lib/workspaceProvider";

import { Modal, ModalAction } from './Modal';

interface AppModalProps {
    type: ModalType;
    skillMap?: SkillMap;
    userState?: UserState;
    mapId: string;
    activity?: MapNode;
    pageSourceUrl?: string;
    actions?: ModalAction[];
    dispatchHideModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string) => void;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchResetUser: () => void;
    dispatchSetReloadHeaderState: (state: "reload" | "reloading" | "active") => void;
}

interface AppModalState {
    loading?: boolean;
    data?: ShareModalData;
}

interface ShareModalData {
    shortId: string;
}

export class AppModalImpl extends React.Component<AppModalProps, AppModalState> {
    constructor (props: AppModalProps) {
        super(props);
        this.state = {};
    }

    render() {
        const  { activity, type } = this.props;

        switch (type) {
            case "completion":
                if (!activity) return <div />
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
            case "share":
                return this.renderShareModal();
            default:
                return <div/>
        }
    }

    protected handleOnClose = () => {
        this.setState({ loading: false, data: undefined });
        this.props.dispatchHideModal();
    }

    protected getRewardText(type: MapRewardType) {
        switch (type) {
            case "certificate":
                return lf("Certificate");
            default:
                return lf("Reward");
        }
    }

    renderCompletionModal() {
        const  { mapId, skillMap, type, activity } = this.props;
        if (!type || !skillMap) return <div />

        const reward = activity as MapReward;

        const completionModalTitle = lf("You Did It!");
        const completionModalText = lf("Congratulations on completing {0}. Take some time to explore any activities you missed, or reset your progress to try again. But first, be sure to claim your reward using the button below.", "{0}");
        const completionModalTextSegments = completionModalText.split("{0}");

        const density = 100;

        const actions = [
            { label: this.getRewardText(reward.type),  onClick: () => {
                tickEvent("skillmap.reward", { path: mapId, activity: reward.activityId });
                window.open(reward.url || skillMap.completionUrl);
            } }
        ]

        return <div className="confetti-container">
            <Modal title={completionModalTitle} actions={actions} className="completion" onClose={this.handleOnClose}>
                {completionModalTextSegments[0]}{<strong>{skillMap.displayName}</strong>}{completionModalTextSegments[1]}
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
        const restartModalText = lf("Are you sure you want to restart {0}? You won't lose your path progress but the code you have written for this activity will be deleted.", "{0}");
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
        const  { skillMap, activity, pageSourceUrl, userState, dispatchHideModal, dispatchSetReloadHeaderState } = this.props;
        const carryoverModalTitle = lf("Keep code from previous activity?");
        const carryoverModalText = lf("Do you want to start with your code from {0} or start fresh with starter code? Your images, tilemaps, tiles, and animations will stick around either way.");
        const carryoverModalTextSegments = carryoverModalText.split("{0}");

        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        const previous = skillMap!.activities[previousState?.activityId];

        if (!previous) return <div />

        const actions = [
            { label: lf("START FRESH"), onClick: async () => {
                tickEvent("skillmap.startfresh", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchSetReloadHeaderState("reloading")

                await carryoverProjectCode(userState!, pageSourceUrl!, skillMap!, activity!.activityId, false)

                dispatchSetReloadHeaderState("reload");
                dispatchHideModal();
            } },
            { label: lf("KEEP CODE"), onClick: async () => {
                tickEvent("skillmap.keepcode", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchSetReloadHeaderState("reloading")

                await carryoverProjectCode(userState!, pageSourceUrl!, skillMap!, activity!.activityId, true)

                dispatchSetReloadHeaderState("reload");
                dispatchHideModal();
            } }
        ]

        return <Modal title={carryoverModalTitle} actions={actions} onClose={this.handleOnClose}>
            {carryoverModalTextSegments[0]}{<strong>{previous!.displayName}</strong>}{carryoverModalTextSegments[1]}
        </Modal>
    }

    protected handleShareInputClick = (evt: any) => { evt.target.select() }
    protected handleShareCopyClick = () => {
        const { mapId, activity } = this.props;
        tickEvent("skillmap.share.copy", { path: mapId, activity: activity!.activityId });
        const input = document.querySelector(".share-input input") as HTMLInputElement;
        if (input) {
            input.select();
            document.execCommand("copy");
        }
    }

    renderShareModal() {
        const { userState, pageSourceUrl, mapId, activity } = this.props;
        const { loading, data } = this.state;
        const resetModalTitle = data?.shortId ? lf("Share Project") : lf("Publish Project");

        const actions = [];
        if (!data?.shortId) {
            actions.push({ label: lf("Cancel"), onClick: () => this.handleOnClose });
            actions.push({ label: lf("Publish"), onClick: async () => {
                tickEvent("skillmap.share", { path: mapId, activity: activity!.activityId });
                this.setState({ loading: true });

                const progress = lookupActivityProgress(userState!, pageSourceUrl!, mapId!, activity!.activityId);
                const project = await getProjectAsync(progress?.headerId || "");
                const jsonScript = await postShareAsync(project?.header, project?.text);

                if (jsonScript?.shortid) this.setState({ loading: false, data: { shortId: jsonScript?.shortid} });
            }});
        }


        return <Modal title={resetModalTitle} actions={actions} onClose={this.handleOnClose}>
            {data?.shortId ?
                <div>{ lf("Your project is ready! Use the address below to share your projects.") }</div> :
                <div className="share-disclaimer">
                    { lf("You need to publish your project to share it or embed it in other web pages. You acknowledge having consent to publish this project.") }
                </div>
            }
            {loading && <div className="share-loader">
                <div className="ui active inline loader" />
                <span>{lf("Loading...")}</span>
            </div>}
            {data?.shortId && <div className="share-input">
                <input type="text" readOnly={true} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    value={`https://makecode.com/${data?.shortId}`} onClick={this.handleShareInputClick}></input>
                <div className="share-copy" onClick={this.handleShareCopyClick} role="button">
                    <i className="icon copy" />
                    {lf("Copy")}
                </div>
            </div>}
        </Modal>
    }

}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { pageSourceUrl } = state;
    const { currentMapId, currentActivityId, type } = state.modal || {};

    // Set the map as currently open map (editorView), or mapId passed into modal
    const currentMap = state.editorView ?
        state.maps[state.editorView.currentMapId] :
        (currentMapId && state.maps[currentMapId]);

    return {
        type,
        pageSourceUrl,
        skillMap: currentMap,
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
