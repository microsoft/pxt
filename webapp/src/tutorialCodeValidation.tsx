/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import { TutorialCard } from "./tutorial";

type ISettingsProps = pxt.editor.ISettingsProps;

interface TutorialCodeValidationProps extends ISettingsProps {
    onYesButtonClick: () => void;
    onNoButtonClick: () => void;
    initialVisible: boolean;
}

interface tutorialCodeValidationState {
    visible: boolean;
}

export class MoveOn extends data.Component<TutorialCodeValidationProps, tutorialCodeValidationState> {
    constructor(props: TutorialCodeValidationProps) {
        super(props);

        this.state = { visible: this.props.initialVisible };
    }

    showUnusedBlocksMessage(vis: boolean) {
        this.setState({ visible: vis });
    }

    moveOnToNextTutorialStep() {
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }

    stayOnThisTutorialStep() {
        this.props.onNoButtonClick();
    }

    renderCore() {
        const vis = this.state.visible;
        return <div>
            <div className={`tutorialCodeValidation no-select ${!vis ? 'hidden' : ''}`}>
                <div className="text">
                    {lf("These are the blocks you seem to be missing.")}
                </div>
                <div className="text">
                    { /* Will add a list a blocks here in future PR */}
                </div>
                <div className="text">
                    {lf("Do you still want to continue?")}
                </div>
                <div className="moveOnButtons">
                    <sui.Button className="yes" ariaLabel={lf("yes button for tutorial code validation")} onClick={this.moveOnToNextTutorialStep.bind(this)} onKeyDown={sui.fireClickOnEnter} > {lf("Continue Anyways")} </sui.Button>
                    <sui.Button className="no" ariaLabel={lf("no button for tutorial code validation")} onClick={this.stayOnThisTutorialStep.bind(this)} onKeyDown={sui.fireClickOnEnter} > {lf("Keep Editing")} </sui.Button>
                </div>
            </div>
        </div>;
    }
}

