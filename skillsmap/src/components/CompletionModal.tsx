/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
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

        const actions = [
            { label: "NEXT", onClick: () => console.log(activity?.next?.[0]?.activityId || "no next") },
            { label: "REWARDS", onClick: () => console.log("rewards") }
        ]

        return <Modal title="Activity Complete!" actions={actions} onClose={() => dispatchHideCompletionModal()}>
            Good work! You've completed {<strong>{activity.displayName}</strong>}. Keep going?
        </Modal>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
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
