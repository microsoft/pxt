import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowCompletionModal, dispatchShowLoginModal } from '../actions/dispatch';

import { ActivityStatus } from '../lib/skillMapUtils';
import { tickEvent } from "../lib/browserUtils";
import { Button } from "react-common/components/controls/Button";
import { SkillMapState } from "../store/reducer";

interface OwnProps {
    mapId: string;
    activityId: string;
    status?: ActivityStatus;
    signedIn?: boolean;
}

interface DispatchProps {
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId: string) => void;
    dispatchShowLoginModal: () => void;
}

type RewardActionsProps = OwnProps & DispatchProps;

export class RewardActionsImpl extends React.Component<RewardActionsProps> {
    protected handleActionButtonClick = () => {
        const { status, mapId, activityId, dispatchShowCompletionModal } = this.props;
        switch (status) {
            case "locked":
                break;
            default:
                tickEvent("skillmap.sidebar.reward", { path: mapId, activity: activityId })
                return dispatchShowCompletionModal(mapId, activityId)
        }
    }

    render() {
        const { status, signedIn, dispatchShowLoginModal } = this.props;
        if (status === "locked") return <div />

        const showSignIn = pxt.auth.hasIdentity() && !signedIn;

        return (
            <div className="actions">
                <Button
                    tabIndex={-1}
                    ariaPosInSet={1}
                    ariaSetSize={showSignIn ? 2 : 1}
                    className="primary inverted"
                    title={lf("Claim Reward")}
                    label={lf("Claim Reward")}
                    onClick={this.handleActionButtonClick}
                />
                <Button
                    tabIndex={-1}
                    ariaPosInSet={2}
                    ariaSetSize={showSignIn ? 2 : 1}
                    className="primary inverted"
                    title={lf("Play your game")}
                    label={lf("Play your game")}
                    onClick={this.handleActionButtonClick}
                />
                {showSignIn &&
                    <Button
                        tabIndex={-1}
                        ariaPosInSet={3}
                        ariaSetSize={3}
                        className="teal"
                        onClick={dispatchShowLoginModal}
                        label={lf("Sign in to Save")}
                        title={lf("Sign in to Save")}
                    />
                }
            </div>
            )
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    return {
        signedIn: state.auth.signedIn
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowCompletionModal,
    dispatchShowLoginModal
}

export const RewardActions = connect(mapStateToProps, mapDispatchToProps)(RewardActionsImpl);