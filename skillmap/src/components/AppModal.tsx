/// <reference path="../lib/skillMap.d.ts" />

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/modal.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

import * as React from "react";
import { connect } from 'react-redux';
import { ModalState, ModalType, ShareState, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchNextModal, dispatchShowShareModal, dispatchRestartActivity, dispatchOpenActivity, dispatchResetUser, dispatchShowCarryoverModal, dispatchSetShareStatus, dispatchCloseUserProfile, dispatchShowUserProfile, dispatchShowLoginModal } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync, resolvePath, postShareAsync } from "../lib/browserUtils";
import { lookupActivityProgress, lookupPreviousActivityStates, lookupPreviousCompletedActivityState, isCodeCarryoverEnabled, getCompletionBadge, isRewardNode } from "../lib/skillMapUtils";
import { getProjectAsync } from "../lib/workspaceProvider";
import { editorUrl } from "./makecodeFrame";

import { Modal, ModalAction } from 'react-common/controls/Modal';
import { jsxLF } from "react-common/util";
import { Badge } from "react-common/profile/Badge";
import { Button } from "react-common/controls/Button";
import { Input } from "react-common/controls/Input";
import { SignInModal } from "react-common/profile/SignInModal";

interface AppModalProps {
    type: ModalType;
    skillMap?: SkillMap;
    userState?: UserState;
    mapId: string;
    activity?: MapNode;
    pageSourceUrl?: string;
    actions?: ModalAction[];
    showCodeCarryoverModal?: boolean;
    shareState?: ShareState;
    hasPendingModals?: boolean;
    reward?: MapReward;
    badge?: pxt.auth.Badge;
    signedIn: boolean;
    dispatchHideModal: () => void;
    dispatchNextModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchOpenActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchShowCarryoverModal: (mapId: string, activityId: string) => void;
    dispatchShowUserProfile: () => void;
    dispatchCloseUserProfile: () => void;
    dispatchResetUser: () => void;
    dispatchSetShareStatus: (headerId?: string, url?: string) => void;
    dispatchShowShareModal: (mapId: string, activityId: string, teamsShare?: boolean) => void;
    dispatchShowLoginModal: () => void;
}

interface AppModalState {
    loading?: boolean;
    data?: ShareModalData;
    checkboxSelected?: boolean; // For the Login modal and delete confirmation
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
            case "login":
                return this.renderLoginModal(false);
            case "login-prompt":
                return this.renderLoginModal(true);
            case "delete-account":
                return this.renderDeleteAccountModal();
            case "reward":
                return this.renderRewardModal();
            default:
                return <div/>
        }
    }

    protected handleOnClose = () => {
        this.setState({ loading: false, data: undefined, checkboxSelected: false });
        this.props.dispatchHideModal();
        this.props.dispatchSetShareStatus();
    }

    protected handleRewardShareClick = () => {
        const { mapId, userState, pageSourceUrl, skillMap, activity, shareState } = this.props;
        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        if (previousState)
            this.props.dispatchShowShareModal(mapId, previousState.activityId, true);
    }

    protected getCompletionActionText(action: MapCompletionAction) {
        switch (action.kind) {
            case "activity":
                return lf("Start Activity")
            case "map":
                return lf("Start Skill Map")
            case "editor":
                return lf("Keep Building")
            case "tutorial":
                return lf("Start Tutorial")
            case "docs":
            default:
                return lf("Learn More")
        }
    }

    protected getCompletionActions(actions: MapCompletionAction[]) {
        const { userState, pageSourceUrl, mapId, skillMap, activity,
            dispatchOpenActivity, dispatchShowCarryoverModal } = this.props;
        const reward = activity as MapRewardNode;
        const modalActions: ModalAction[] = [];
        actions?.forEach(el => {
            const action: Partial<ModalAction> = {
                label: el.label || this.getCompletionActionText(el),
                url: el.url
            }
            switch (el.kind) {
                case "activity":
                    const nextActivity = skillMap?.activities[el.activityId || ""];
                    if (nextActivity) {
                        action.onClick = () => {
                            tickEvent("skillmap.reward.action.activity", { path: mapId, activity: reward.activityId, nextActivityId: nextActivity.activityId });
                            this.handleOnClose();
                            if (isCodeCarryoverEnabled(userState!, pageSourceUrl!, skillMap!, nextActivity)) {
                                dispatchShowCarryoverModal(skillMap!.mapId, nextActivity.activityId);
                            } else {
                                dispatchOpenActivity(mapId, nextActivity.activityId);
                            }
                        };
                        modalActions.push(action as ModalAction);
                    }
                    break;
                case "editor":
                    const previousActivity = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
                    if (previousActivity?.headerId) {
                        action.onClick = () => {
                            tickEvent("skillmap.reward.action.editor", { path: mapId, activity: reward.activityId });
                            window.open(`${editorUrl}#skillmapimport:${previousActivity.headerId}`);
                        };
                        modalActions.push(action as ModalAction);
                    }
                    break;
                case "tutorial":
                case "map":
                case "docs":
                default:
                    action.onClick = () => tickEvent(`skillmap.reward.action.${el.kind}`, { path: mapId, activity: reward.activityId, url: action.url || "" });
                    modalActions.push(action as ModalAction);
            }
        })
        return modalActions;
    }

    renderConfetti() {
        const density = 100;
        return Array(density).fill(0).map((el, i) => {
            const style = {
                animationDelay: `${0.1 * (i % density)}s`,
                left: `${1 * (Math.floor(Math.random() * density))}%`
            }
            return <div key={i} style={style} className={`confetti ${Math.random() > 0.5 ? "reverse" : ""} color-${Math.floor(Math.random() * 9)}`} />
        })
    }

    renderCompletionModal() {
        const  { skillMap, type, activity, userState, pageSourceUrl, dispatchNextModal, reward, mapId } = this.props;
        if (!type || !skillMap) return <div />

        const node = activity as MapRewardNode;

        const completionModalTitle = lf("You Did It!");
        const completionModalText = lf("Congratulations on completing {0}. Take some time to explore any activities you missed, or reset your progress to try again. But first, be sure to claim your reward using the button below.", "{0}");
        const completionModalTextSegments = completionModalText.split("{0}");

        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);


        const onCertificateClick = () => {
            tickEvent("skillmap.openCertificate", { path: mapId, activity: activity!.activityId });
            window.open((reward as MapRewardCertificate).url || skillMap!.completionUrl);
        };

        const onButtonClick = reward ? onCertificateClick : dispatchNextModal

        return <div className="confetti-container">
            <Modal title={completionModalTitle} actions={this.getCompletionActions(node.actions)} className="completion" onClose={this.handleOnClose}>
                {completionModalTextSegments[0]}{<strong>{skillMap.displayName}</strong>}{completionModalTextSegments[1]}
                <Button
                    className="primary completion-reward"
                    title={lf("Claim your reward!")}
                    label={lf("Claim your reward!")}
                    leftIcon="fas fa-gift"
                    onClick={onButtonClick} />
                {(previousState && previousState.headerId) &&
                    <Button
                        className="primary completion-reward"
                        title={lf("Share your game!")}
                        label={lf("Share your game!")}
                        leftIcon="fas fa-share"
                        onClick={this.handleRewardShareClick} />
                }
            </Modal>
            {this.renderConfetti()}
        </div>
    }

    renderRestartWarning() {
        const  { userState, pageSourceUrl, skillMap, mapId, activity, dispatchRestartActivity, showCodeCarryoverModal, dispatchShowCarryoverModal } = this.props;
        const restartModalTitle = lf("Restart Activity?");
        const restartModalText = lf("Are you sure you want to restart {0}? You won't lose your path progress but the code you have written for this activity will be deleted.", "{0}");
        const restartModalTextSegments = restartModalText.split("{0}");

        const actions = [
            { label: lf("CANCEL"), onClick: this.handleOnClose },
            { label: lf("RESTART"), onClick: () => {
                tickEvent("skillmap.activity.restart", { path: mapId, activity: activity!.activityId });
                if (showCodeCarryoverModal) {
                    const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
                    dispatchRestartActivity(mapId, activity!.activityId, previousState.headerId, !!previousState.headerId);
                } else {
                    dispatchRestartActivity(mapId, activity!.activityId);
                }
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
        const  { skillMap, activity, pageSourceUrl, userState, dispatchHideModal, dispatchRestartActivity } = this.props;
        const carryoverModalTitle = lf("Keep code from previous activity?");
        const carryoverModalText = lf("Do you want to start with your code from {0} or start fresh with starter code? Your images, tilemaps, tiles, and animations will stick around either way.");
        const carryoverModalTextSegments = carryoverModalText.split("{0}");

        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        const previous = skillMap!.activities[previousState?.activityId];

        if (!previous) return <div />

        const actions = [
            { label: lf("START FRESH"), onClick: async () => {
                tickEvent("skillmap.startfresh", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchRestartActivity(skillMap!.mapId, activity!.activityId, previousState.headerId, false);
                dispatchHideModal();
            } },
            { label: lf("KEEP CODE"), onClick: async () => {
                tickEvent("skillmap.keepcode", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchRestartActivity(skillMap!.mapId, activity!.activityId, previousState.headerId, true);
                dispatchHideModal();
            } }
        ]

        return <Modal title={carryoverModalTitle} actions={actions} onClose={this.handleOnClose}>
            {carryoverModalTextSegments[0]}{<strong>{previous!.displayName}</strong>}{carryoverModalTextSegments[1]}
        </Modal>
    }

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
        const { userState, pageSourceUrl, mapId, activity, shareState, dispatchSetShareStatus } = this.props;
        const { loading } = this.state;

        const shortId = shareState?.url;

        const resetModalTitle = shortId ? lf("Share Project") : lf("Publish Project");

        const actions = [];
        if (!shortId) {
            actions.push({ label: lf("Cancel"), onClick: this.handleOnClose });
            actions.push({ label: lf("Publish"), onClick: async () => {
                tickEvent("skillmap.share", { path: mapId, activity: activity!.activityId });
                this.setState({ loading: true });

                const progress = lookupActivityProgress(userState!, pageSourceUrl!, mapId!, activity!.activityId);

                dispatchSetShareStatus(progress?.headerId);
            }});
        }

        return <Modal title={resetModalTitle} actions={actions} onClose={this.handleOnClose}>
            {shortId ?
                <div>{ lf("Your project is ready! Use the address below to share your projects.") }</div> :
                <div className="share-disclaimer">
                    { lf("You need to publish your project to share it or embed it in other web pages. You acknowledge having consent to publish this project.") }
                </div>
            }
            {(loading && !shortId) && <div className="share-loader">
                <div className="common-spinner" />
                <span>{lf("Loading...")}</span>
            </div>}
            {shortId && <Input
                    type="text"
                    className="share-input"
                    ariaLabel="Generated shareable URL for project"
                    initialValue={`https://makecode.com/${shortId}`}
                    icon="fas fa-copy"
                    iconTitle="Copy project URL"
                    readOnly={true}
                    autoComplete={false}
                    selectOnClick={true}
                    onIconClick={this.handleShareCopyClick} />}
            {(shortId && shareState?.rewardsShare) && <div>
                {this.renderConfetti()}
            </div>}
        </Modal>
    }

    renderLoginModal(activityPrompt: boolean) {

        const signInAsync = async (provider: pxt.AppCloudProvider, rememberMe: boolean): Promise<void> => {
            pxt.tickEvent(`identity.loginClick`, { provider: provider.name!, rememberMe: rememberMe.toString() });
            await pxt.auth.client().loginAsync(provider.id, rememberMe, { hash: location.hash });
        }

        return <>
            {activityPrompt && <SignInModal appMessage={lf("Nice work! You've completed this activity.")} onSignIn={signInAsync} onClose={this.handleOnClose} />}
            {!activityPrompt && <SignInModal onSignIn={signInAsync} onClose={this.handleOnClose} />}
        </>
    }

    renderDeleteAccountModal() {
        const { checkboxSelected } = this.state;

        const buttons = [];
        buttons.push({
            label: lf("Confirm"),
            disabled: !checkboxSelected,

            onClick: async () => {
                if (checkboxSelected) {
                    tickEvent("skillmap.profile.delete");
                    this.props.dispatchHideModal();
                    this.props.dispatchCloseUserProfile();
                    await pxt.auth.client().deleteProfileAsync();
                    location.reload();
                }
            }
        })

        buttons.push({
            label: lf("Back to safety"),
            onClick: this.props.dispatchHideModal
        })

        return <Modal title={lf("Delete Profile")} className="delete" actions={buttons} onClose={this.handleOnClose}>
            <div> { lf("Are you sure? This cannot be reversed! Your cloud-saved projects will be converted to local projects on this device.") }
            </div>
            <div className="confirm-delete checkbox" onClick={() => {
                    this.setState({ checkboxSelected: !checkboxSelected });
                }}>
                <i className={`far ${checkboxSelected ? "fa-check-square" : "fa-square"}`} />
                { lf("I understand this is permanent. No undo.") }
            </div>
        </Modal>
    }

    renderRewardModal() {
        const { reward } = this.props;

        let modal: JSX.Element | undefined;

        if (reward?.type === "certificate") modal = this.renderCertificateModal(reward);
        else if (reward?.type === "completion-badge") modal = this.renderBadgeModal(reward);

        return <div className="confetti-container">
            {modal}
            {this.renderConfetti()}
        </div>
    }

    renderCertificateModal(reward: MapRewardCertificate) {
        const title = lf("Rewards");
        const  { mapId, skillMap, activity, hasPendingModals, dispatchNextModal } = this.props;

        const buttons: ModalAction[] = [];

        const onCertificateClick = () => {
            tickEvent("skillmap.openCertificate", { path: mapId, activity: activity!.activityId });
            window.open((reward as MapRewardCertificate).url || skillMap!.completionUrl);
        };

        buttons.push(
            {
                label: lf("Open Certificate"),
                className: "completion-reward inverted",
                icon: "file outline",
                onClick: onCertificateClick
            }
        )

        if (hasPendingModals) {
            const onNextRewardClick = () => {
                tickEvent("skillmap.nextReward", { path: mapId, activity: activity!.activityId, currentReward: reward!.type });
                dispatchNextModal();
            };

            buttons.push(
                {
                    label: lf("Next Reward"),
                    className: "completion-reward",
                    icon: "right circle arrow",
                    onClick: onNextRewardClick
                }
            )
        }

        return <Modal title={title} onClose={this.handleOnClose} actions={buttons}>
            {lf("Use the button below to get your completion certificate!")}
            {reward.previewUrl &&
                <div className="certificate-reward">
                    <img src={reward.previewUrl} alt={lf("certificate Preview")} />
                </div>
            }
        </Modal>
    }

    renderBadgeModal(reward: MapCompletionBadge) {
        const title = lf("Rewards");
        const  { mapId, skillMap, activity, hasPendingModals, badge, dispatchNextModal, dispatchShowUserProfile, dispatchHideModal, signedIn, dispatchShowLoginModal } = this.props;

        const goToBadges = () => {
            tickEvent("skillmap.goToBadges", { path: mapId, activity: activity!.activityId });
            dispatchHideModal();
            dispatchShowUserProfile();
        }

        const signIn = () => {
            tickEvent("skillmap.badgeSignIn", { path: mapId, activity: activity!.activityId });
            dispatchHideModal();
            dispatchShowLoginModal();
        }

        const buttons: ModalAction[] = [];
        let message: JSX.Element[];

        if (signedIn) {
            message = jsxLF(
                lf("You’ve received the {0} Badge! Find it in the badges section of your {1}."),
                <span>{pxt.U.rlf(badge!.title)}</span>,
                <a onClick={goToBadges}>{lf("User Profile")}</a>
            );
            buttons.push(
                {
                    label: lf("Go to Badges"),
                    className: "completion-reward inverted",
                    icon: "trophy",
                    onClick: goToBadges
                }
            )
        }
        else {
            message = jsxLF(
                lf("You’ve received the {0} Badge! {1} to save your progress"),
                <span>{pxt.U.rlf(skillMap!.displayName)}</span>,
                <a onClick={signIn}>{lf("Sign In")}</a>
            );
            buttons.push(
                {
                    label: lf("Sign In"),
                    className: "completion-reward inverted",
                    xicon: true,
                    icon: "cloud-user",
                    onClick: signIn
                }
            )
        }

        if (hasPendingModals) {
            const onNextRewardClick = () => {
                tickEvent("skillmap.nextReward", { path: mapId, activity: activity!.activityId, currentReward: reward!.type });
                dispatchNextModal();
            };

            buttons.push(
                {
                    label: lf("Next Reward"),
                    className: "completion-reward",
                    icon: "right circle arrow",
                    onClick: onNextRewardClick
                }
            )
        }


        return <Modal title={title} onClose={this.handleOnClose} actions={buttons}>
            {message}
            <div className="badge-modal-image">
                <Badge badge={badge!} />
            </div>
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { pageSourceUrl, shareState } = state;
    const [ modal ] = state.modalQueue || [];
    const { currentMapId, currentActivityId, type, currentReward } = modal || {};

    // Set the map as currently open map (editorView), or mapId passed into modal
    const currentMap = state.editorView ?
        state.maps[state.editorView.currentMapId] :
        (currentMapId && state.maps[currentMapId]);
    const activity = (currentMapId && currentActivityId) ? state.maps[currentMapId]?.activities[currentActivityId] : undefined

    let badge: pxt.auth.Badge | undefined;
    if (currentMap && activity && isRewardNode(activity) && currentReward?.type === "completion-badge") {
        badge = getCompletionBadge(pageSourceUrl, currentMap, activity as MapRewardNode);
    }

    return {
        type,
        pageSourceUrl,
        skillMap: currentMap,
        userState: state.user,
        showCodeCarryoverModal: currentMap && activity && isCodeCarryoverEnabled(state.user, state.pageSourceUrl, currentMap, activity),
        mapId: currentMapId,
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined,
        shareState,
        reward: currentReward,
        hasPendingModals: state.modalQueue?.length && state.modalQueue?.length > 1,
        badge,
        signedIn: state.auth.signedIn,
    }
}

const mapDispatchToProps = {
    dispatchHideModal,
    dispatchRestartActivity,
    dispatchOpenActivity,
    dispatchResetUser,
    dispatchShowCarryoverModal,
    dispatchCloseUserProfile,
    dispatchSetShareStatus,
    dispatchShowShareModal,
    dispatchNextModal,
    dispatchShowUserProfile,
    dispatchShowLoginModal
};

export const AppModal = connect(mapStateToProps, mapDispatchToProps)(AppModalImpl);
