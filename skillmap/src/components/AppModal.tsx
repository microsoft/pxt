/// <reference path="../lib/skillMap.d.ts" />

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/modal.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

import * as React from "react";
import { connect } from 'react-redux';
import { ModalType, PageSourceStatus, ShareState, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchNextModal, dispatchShowShareModal, dispatchRestartActivity, dispatchOpenActivity, dispatchResetUser, dispatchShowCarryoverModal, dispatchSetShareStatus, dispatchCloseUserProfile, dispatchShowUserProfile, dispatchShowLoginModal } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync} from "../lib/browserUtils";
import { lookupActivityProgress, lookupPreviousCompletedActivityState, isCodeCarryoverEnabled, getCompletionBadge, isRewardNode } from "../lib/skillMapUtils";
import { editorUrl } from "./makecodeFrame";

import { Modal, ModalAction } from 'react-common/components/controls/Modal';
import { jsxLF } from "react-common/components/util";
import { Badge } from "react-common/components/profile/Badge";
import { Button } from "react-common/components/controls/Button";
import { Confetti } from "react-common/components/animations/Confetti";
import { SignInModal } from "react-common/components/profile/SignInModal";
import { Share, ShareData } from "react-common/components/share/Share";
import { Input } from 'react-common/components/controls/Input';
import { pdfRenderNameField, loadPdfLibAsync } from '../lib/pdfUtil';

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
    profile?: pxt.auth.UserProfile;
    pageSourceState?: PageSourceStatus;
    dispatchHideModal: () => void;
    dispatchNextModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchOpenActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchShowCarryoverModal: (mapId: string, activityId: string) => void;
    dispatchShowUserProfile: () => void;
    dispatchCloseUserProfile: () => void;
    dispatchResetUser: () => void;
    dispatchSetShareStatus: (headerId?: string, projectName?: string, data?: ShareData) => void;
    dispatchShowShareModal: (mapId: string, activityId: string, teamsShare?: boolean) => void;
    dispatchShowLoginModal: () => void;
}

interface AppModalState {
    loading?: boolean;
    checkboxSelected?: boolean; // For the Login modal and delete confirmation
    resolvePublish?: (data: ShareData) => void;
}

export class AppModalImpl extends React.Component<AppModalProps, AppModalState> {
    protected textInput: HTMLInputElement | undefined;

    constructor (props: AppModalProps) {
        super(props);
        this.state = {};
    }

    componentDidUpdate(prevProps: Readonly<AppModalProps>, prevState: Readonly<AppModalState>, snapshot?: any): void {
        if (this.state.resolvePublish && this.props.shareState?.data) {
            const resolve = this.state.resolvePublish;
            this.setState({
                resolvePublish: undefined
            });
            resolve(this.props.shareState.data);
        }
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
        this.setState({ loading: false, resolvePublish: undefined, checkboxSelected: false });
        this.props.dispatchHideModal();
        this.props.dispatchSetShareStatus();
    }

    protected handleRewardShareClick = () => {
        const { mapId, userState, pageSourceUrl, skillMap, activity, shareState } = this.props;
        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        if (previousState)
            this.props.dispatchShowShareModal(mapId, previousState.activityId, true);
    }

    protected handleMultiplayerShareClick = async () => {
        const { mapId, userState, pageSourceUrl, skillMap, activity } = this.props;
        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        const prevActivity = skillMap?.activities[previousState.activityId];

        const shareInfo = await this.publishAsync(prevActivity?.displayName!, userState!, pageSourceUrl!, mapId, prevActivity!);

        const domain = pxt.BrowserUtils.isLocalHostDev() ? "http://localhost:3000/--" : pxt.webConfig.relprefix;

        const shareId = shareInfo.url.split("/").slice(-1)[0];
        const multiplayerHostUrl = `${domain}multiplayer?host=${shareId}`;
        window.open(multiplayerHostUrl, "_blank");
    }

    protected getCompletionActionText(action: MapCompletionAction) {
        switch (action.kind) {
            case "activity":
                return lf("Start Activity")
            case "map":
                return lf("Start Skillmap")
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

        const shouldShowShare = previousState && previousState.headerId;
        const showMultiplayerShare = shouldShowShare && (activity as MapCompletionNode).showMultiplayerShare;

        return <Confetti>
            <Modal title={completionModalTitle} actions={this.getCompletionActions(node.actions)} className="completion" onClose={this.handleOnClose}>
                {completionModalTextSegments[0]}{<strong>{skillMap.displayName}</strong>}{completionModalTextSegments[1]}
                <Button
                    className="primary completion-reward"
                    title={lf("Claim your reward!")}
                    label={lf("Claim your reward!")}
                    leftIcon="fas fa-gift"
                    onClick={onButtonClick} />
                {shouldShowShare && !showMultiplayerShare &&
                    <Button
                        className="primary completion-reward"
                        title={lf("Share your game!")}
                        label={lf("Share your game!")}
                        leftIcon="fas fa-share"
                        onClick={this.handleRewardShareClick} />
                }
                {showMultiplayerShare &&
                    <Button
                        className="primary completion-reward"
                        title={lf("Play online with friends!")}
                        label={lf("Play online with friends!")}
                        leftIcon="fas fa-share"
                        onClick={this.handleMultiplayerShareClick} />
                }
            </Modal>
        </Confetti>
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

    protected publishAsync = async (name: string, userState: UserState, pageSourceUrl: string, mapId: string, activity: MapNode) => {
        const { dispatchSetShareStatus } = this.props;
        tickEvent("skillmap.share", { path: mapId, activity: activity.activityId });
        const progress = lookupActivityProgress(userState, pageSourceUrl, mapId!, activity.activityId);

        dispatchSetShareStatus(progress?.headerId, name);

        return new Promise<ShareData>(resolve => {
            this.setState({
                resolvePublish: resolve
            })
        });
    };

    renderShareModal() {
        const { activity, userState, pageSourceUrl, mapId } = this.props;

        const publishAsync = (name: string) =>
            this.publishAsync(name, userState!, pageSourceUrl!, mapId, activity!)


        return <Modal
            title={lf("Share Project")}
            className="sharedialog"
            parentElement={document.getElementById("root") || undefined}
            onClose={this.handleOnClose}>
            <Share projectName={activity!.displayName}
                isLoggedIn={false}
                publishAsync={publishAsync}
                simRecorder={undefined as any}
                onClose={this.handleOnClose} />
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

        return <Confetti>
            {modal}
        </Confetti>
    }

    renderCertificateModal(reward: MapRewardCertificate) {
        const title = lf("Rewards");
        const  {
            mapId,
            skillMap,
            activity,
            hasPendingModals,
            dispatchNextModal,
            profile,
            signedIn,
            pageSourceState
        } = this.props;
        const isApproved = pageSourceState === "approved";
        const isApprovedPdfCert = isApproved && reward.url?.toLowerCase().endsWith(".pdf");

        if (isApprovedPdfCert) {
            // start loading pdf-lib immediately as it is a lazy dep
            loadPdfLibAsync();
        }

        const handleNamedCert = async () => {
            const pdfBuf = await fetch(reward.url).then((res) => res.arrayBuffer());
            let namedPdfBuf: ArrayBuffer | undefined;
            try {
                namedPdfBuf = await pdfRenderNameField(pdfBuf, this.textInput?.value);
            } catch (e) {
                // Rendering name failed for some reason, just use empty pdf as back up.
            }
            const blobObj = new Blob(
                [ namedPdfBuf || pdfBuf ],
                { type: "application/pdf" }
            );
            const blobUrl = URL.createObjectURL(blobObj);
            window.open(blobUrl, "_blank", "noopener noreferrer");
        }

        const buttons: ModalAction[] = [];

        const onCertificateClick = () => {
            tickEvent("skillmap.openCertificate", {
                path: mapId,
                activity: activity!.activityId,
                addedName: !!this.textInput?.value?.trim() ? 1 : 0
            });
            if (isApprovedPdfCert) {
                handleNamedCert();
            } else {
                window.open(reward.url || skillMap!.completionUrl);
            }

            if (hasPendingModals) {
                dispatchNextModal();
            } else {
                this.handleOnClose();
            }
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

        const handleInputRef = (ref: HTMLInputElement) => {
            if (ref) this.textInput = ref;
        }

        const firstName = signedIn && profile && pxt.auth.firstName(profile);

        return <Modal title={title} onClose={this.handleOnClose} actions={buttons}>
            {lf("Use the button below to get your completion certificate!")}
            {reward.previewUrl &&
                <div className="certificate-reward">
                    <img src={reward.previewUrl} alt={lf("certificate Preview")} />
                </div>
            }
            {isApprovedPdfCert &&
                <Input
                    className="cert-name-input"
                    placeholder={"Put your name on it!"}
                    label={lf("Enter your name")}
                    type="text"
                    initialValue={firstName || undefined}
                    handleInputRef={handleInputRef}
                    preserveValueOnBlur={true}
                    onEnterKey={onCertificateClick}
                    title={lf("Enter your name to customize the certificate")}
                    ariaLabel={lf("Enter your name to customize the certificate")}
                />
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
        profile: state.auth.profile,
        pageSourceState: state.pageSourceStatus,
    } as AppModalProps
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
