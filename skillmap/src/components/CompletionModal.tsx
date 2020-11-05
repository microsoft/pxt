/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchOpenActivity, dispatchHideCompletionModal } from '../actions/dispatch';

import { Modal, ModalAction } from './Modal';

type CompletionModalType = "map" | "activity";

interface CompletionModalProps {
    type?: CompletionModalType;
    mapId?: string;
    displayName?: string;
    nextActivityId?: string;
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchHideCompletionModal: () => void;
}

export class CompletionModalImpl extends React.Component<CompletionModalProps> {
    render() {
        const  { type, mapId, displayName, nextActivityId, dispatchOpenActivity, dispatchHideCompletionModal } = this.props;
        if (!type) return <div />

        const completionModalTitle = type === "activity" ? "Activity Complete!" : "Path Complete!";
        const completionModalText = "Good work! You've completed {0}. Keep going!";
        const completionModalTextSegments = completionModalText.split("{0}");

        const actions: ModalAction[] = [];
        if (type === "activity" && mapId && nextActivityId) {
            actions.push({ label:"NEXT", onClick: () => {
                dispatchHideCompletionModal();
                dispatchOpenActivity(mapId, nextActivityId);
             } });
        } else {
            actions.push({ label: "CERTIFICATE", onClick: () => {} });
        }

        return <Modal title={completionModalTitle} actions={actions} onClose={() => dispatchHideCompletionModal()}>
            {completionModalTextSegments[0]}{<strong>{displayName}</strong>}{completionModalTextSegments[1]}
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { currentMapId, currentActivityId } = state.modal || {};
    let type: CompletionModalType | undefined;
    let displayName: string | undefined;
    let nextActivityId: string | undefined;

    if (currentMapId) {
        const map = state.maps[currentMapId];
        if (currentActivityId) {
            const activity = map.activities[currentActivityId];
            type = "activity";
            displayName = activity.displayName;
            nextActivityId = activity.next?.[0].activityId;
        } else {
            type = "map";
            displayName = map.displayName;
        }
    }

    return { type, mapId: currentMapId, displayName, nextActivityId }
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchHideCompletionModal
};

export const CompletionModal = connect(mapStateToProps, mapDispatchToProps)(CompletionModalImpl);
