/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

interface TutorialCodeValidationProps extends pxt.editor.ISettingsProps {
    onYesButtonClick: () => void;
    onNoButtonClick: boolean;
    // unused Blocks : () => void;
}

interface tutorialCodeValidationState {
    visible: boolean;
}

interface tutorialCodeValidationData {
    // Unused blocks - will update in the future
};

export class moveOn extends data.Component<TutorialCodeValidationProps, tutorialCodeValidationState> {
    public elementRef: HTMLDivElement;
    protected setRef: (el: HTMLDivElement) => void = (el) => { this.elementRef = el };

    constructor(props: TutorialCodeValidationProps) {
        super(props);

        this.state = { visible: this.props.onNoButtonClick };
        this.next = this.next.bind(this);
        this.showUnusedBlocksMessage = this.showUnusedBlocksMessage.bind(this);
        this.closedUnusedBlocksMessage = this.closedUnusedBlocksMessage.bind(this);
    }

    showUnusedBlocksMessage(visible: boolean) {
        console.log("visible is " + visible);
        this.setState({ visible });
    }

    protected closedUnusedBlocksMessage() {
        console.log("clicked and in closedUnusedBlockMessage");

        this.showUnusedBlocksMessage(false);
    }

    next() {
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }



    renderCore() {

        const { visible } = this.state;

        return <div id="tutorialCodeValidationID">
            <div className={`tutorialCodeValidation no-select ${!visible ? 'hidden' : ''}`}>
                <p>These are the blocks you seem to be missing.
                /* Will add a list a blocks here in future PR */
                Do you still want to continue?
                </p>
                <div className="moveOnButtons">
                    <sui.Button className={`no ${this.closedUnusedBlocksMessage}`} ariaLabel={lf("no button for tutorial code validation")} onClick={this.closedUnusedBlocksMessage} onKeyDown={sui.fireClickOnEnter} > No </sui.Button>
                    <sui.Button className={`yes ${this.closedUnusedBlocksMessage}`} ariaLabel={lf("yes button for tutorial code validation")} onClick={this.next} onKeyDown={sui.fireClickOnEnter} > Yes </sui.Button>
                </div>

            </div>
        </div>;

    }
}

