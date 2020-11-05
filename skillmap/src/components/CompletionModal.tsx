/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchHideCompletionModal } from '../actions/dispatch';

import { Modal } from './Modal';

interface CompletionModalProps {
    activity?: MapActivity;
    dispatchHideCompletionModal: () => void;
}

export class CompletionModalImpl extends React.Component<CompletionModalProps> {
    render() {
        const  { activity, dispatchHideCompletionModal } = this.props;
        if (!activity) return <div />

        const completionModalTitle = "Activity Complete!";
        const completionModalText = "Good work! You've completed {0}. Keep going?";
        const completionModalTextSegments = completionModalText.split("{0}");

        const hasNext = !!activity?.next;
        const actions = [
            { label: hasNext ? "NEXT" : "DONE", onClick: () => console.log(activity?.next?.[0]?.activityId || "Done") }
        ]

        return <Modal title={completionModalTitle} actions={actions} onClose={() => dispatchHideCompletionModal()}>
            {completionModalTextSegments[0]}{<strong>{activity.displayName}</strong>}{completionModalTextSegments[1]}
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { currentMapId, currentActivityId } = state.modal || {};
    return {
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined
    }
}

const mapDispatchToProps = {
    dispatchHideCompletionModal
};

export const CompletionModal = connect(mapStateToProps, mapDispatchToProps)(CompletionModalImpl);
