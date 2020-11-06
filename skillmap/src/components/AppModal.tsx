/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { ModalType, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchRestartActivity } from '../actions/dispatch';

import { Modal } from './Modal';

interface AppModalProps {
    type: ModalType;
    mapId: string;
    activity?: MapActivity;
    dispatchHideModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string) => void;
}

export class AppModalImpl extends React.Component<AppModalProps> {
    render() {
        const  { activity, type } = this.props;
        if (!activity) return <div />

        switch (type) {
            case "completion":
                return this.renderCompletionModal();
            case "restart-warning":
                return this.renderRestartWarning();
            default:
                return <div/>
        }
    }


    renderCompletionModal() {
        const  { activity, dispatchHideModal } = this.props;
        const completionModalTitle = "Activity Complete!";
        const completionModalText = "Good work! You've completed {0}. Keep going?";
        const completionModalTextSegments = completionModalText.split("{0}");

        const hasNext = !!activity?.next;
        const actions = [
            { label: hasNext ? "NEXT" : "DONE", onClick: () => console.log(activity?.next?.[0]?.activityId || "Done") }
        ]

        return <Modal title={completionModalTitle} actions={actions} onClose={() => dispatchHideModal()}>
            {completionModalTextSegments[0]}{<strong>{activity!.displayName}</strong>}{completionModalTextSegments[1]}
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
                dispatchRestartActivity(mapId, activity!.activityId);
            }}
        ]

        return <Modal title={restartModalTitle} actions={actions} onClose={() => dispatchHideModal()}>
            {restartModalTextSegments[0]}{<strong>{activity!.displayName}</strong>}{restartModalTextSegments[1]}
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { currentMapId, currentActivityId, type } = state.modal || {};
    return {
        type,
        mapId: currentMapId,
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined
    }
}

const mapDispatchToProps = {
    dispatchHideModal,
    dispatchRestartActivity
};

export const AppModal = connect(mapStateToProps, mapDispatchToProps)(AppModalImpl);
