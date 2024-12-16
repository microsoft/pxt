import * as React from "react";
import * as Blockly from "blockly";
import * as blocks from "./blocks";
import { Button } from "../../react-common/components/controls/Button";
import { REVIEW_COMMENT_ICON_TYPE, ReviewCommentIcon } from "../../pxtblocks/plugins/comments/reviewCommentIcon";



export function getBlocksWithFeedback(projView: pxt.editor.IProjectView): Blockly.Block[] {
    if (!projView.isBlocksActive()) {
        return [];
    }

    return projView
        .getBlocks()
        .map((b) => b as Blockly.Block)
        .filter((b) => !!ReviewCommentIcon.getReviewCommentForBlock(b));
}

interface FeedbackPanelProps {
    parent: pxt.editor.IProjectView;
}
interface FeedbackPanelState {
    blocksWithFeedback: Blockly.Block[];
    isBlocksActive: boolean;
    currentIndex: number;
}
export class FeedbackPanel extends React.Component<FeedbackPanelProps, FeedbackPanelState> {
    constructor(props: FeedbackPanelProps) {
        super(props);

        this.state = {
            isBlocksActive: this.props.parent.isBlocksActive(),
            blocksWithFeedback: [],
            currentIndex: 0, // TODO thsparks : This is getting set to NaN for some reason, even with this here??
        };

        this.focusOnBlockAtIndex = this.focusOnBlockAtIndex.bind(this);
        this.handleNextFeedbackClick = this.handleNextFeedbackClick.bind(this);
        this.handlePrevFeedbackClick = this.handlePrevFeedbackClick.bind(this);
    }

    protected handlePrevFeedbackClick = () => {
        const newIndex =
            this.state.currentIndex > 0 ? this.state.currentIndex - 1 : this.state.blocksWithFeedback.length - 1;
        this.setState({ currentIndex: newIndex });
        this.focusOnBlockAtIndex(newIndex);
    };

    protected handleNextFeedbackClick = () => {
        const currentIndex = isNaN(this.state.currentIndex) ? 0 : this.state.currentIndex;
        const newIndex = (currentIndex + 1) % this.state.blocksWithFeedback.length;
        this.setState({ currentIndex: newIndex });
        this.focusOnBlockAtIndex(newIndex);
    };

    protected focusOnBlockAtIndex(index: number) {
        if (!this.props.parent.isBlocksActive()) return;

        const block = this.state.blocksWithFeedback[index];
        if (block) {
            (this.props.parent.editor as blocks.Editor).editor.highlightBlock(block.id);
            (this.props.parent.editor as blocks.Editor).editor.centerOnBlock(block.id);

            block.getIcon(REVIEW_COMMENT_ICON_TYPE)?.setBubbleVisible(true);
        }
    }

    protected getBlocksWithFeedback(): Blockly.Block[] {
        return getBlocksWithFeedback(this.props.parent);
    }

    protected updateBlocksWithFeedbackList() {
        const blocksWithFeedback = this.getBlocksWithFeedback();
        this.setState({ blocksWithFeedback, currentIndex: this.state.currentIndex % blocksWithFeedback.length });
    }

    componentDidMount() {
        this.updateBlocksWithFeedbackList();
    }

    protected shouldUpdate(): boolean {
        if (this.state.isBlocksActive !== this.props.parent.isBlocksActive()) return true;

        const newBlocksWithFeedback = this.getBlocksWithFeedback();
        if (newBlocksWithFeedback.length !== this.state.blocksWithFeedback.length) return true;
        for (const blockId of newBlocksWithFeedback.map((b) => b.id)) {
            if (!this.state.blocksWithFeedback.find((b) => b.id === blockId)) return true;
        }

        return false;
    }

    componentDidUpdate(prevProps: EditorToolbarFeedbackNavProps) {
        if (this.shouldUpdate()) {
            this.updateBlocksWithFeedbackList();

            // Save this so we can tell if it changes.
            this.setState({ isBlocksActive: this.props.parent.isBlocksActive() });
        }
    }

    render() {
        return (
            <div id="feedbackPanel" className="feedback-panel">
                <div id="feedbackNavArea" role="menubar" className="ui column items">
                    <EditorToolbarFeedbackNav
                        parent={this.props.parent}
                        focusOnBlockAtIndex={this.focusOnBlockAtIndex}
                        blocksWithFeedback={this.state.blocksWithFeedback}
                        isBlocksActive={this.state.isBlocksActive}
                        handlePrevFeedbackClick={this.handlePrevFeedbackClick}
                        handleNextFeedbackClick={this.handleNextFeedbackClick}
                    />
                </div>
                <div id="feedbackPanelCommentsArea" className="feedback-comments-area">
                    {this.state.blocksWithFeedback.map((block, index) => {
                        const comment = ReviewCommentIcon.getReviewCommentForBlock(block);
                        return (
                            <InSidebarFeedbackComment
                                key={index}
                                parent={this.props.parent}
                                commentText={comment}
                                index={index}
                                focusOnBlockAtIndex={this.focusOnBlockAtIndex}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }
}

interface InSidebarFeedbackCommentProps {
    parent: pxt.editor.IProjectView;
    commentText: string;
    index: number;
    focusOnBlockAtIndex: (index: number) => void;
}
interface InSidebarFeedbackCommentState {}
class InSidebarFeedbackComment extends React.Component<InSidebarFeedbackCommentProps, InSidebarFeedbackCommentState> {
    constructor(props: InSidebarFeedbackCommentProps) {
        super(props);
        this.state = {};
    }

    protected onClick = () => {
        this.props.focusOnBlockAtIndex(this.props.index);
    };

    render() {
        return (
                <Button
                    label={
                        <div className="feedback-comment-container">
                            <div className="feedback-comment-header">{lf("Feedback")}</div>
                            <div className="feedback-comment-text-area">{this.props.commentText}</div>
                        </div>
                    }
                    className="feedback-comment-btn"
                    title={this.props.commentText}
                    onClick={this.onClick}
                />
        );
    }
}

interface EditorToolbarFeedbackNavProps {
    parent: pxt.editor.IProjectView;
    blocksWithFeedback: Blockly.Block[];
    isBlocksActive: boolean;
    handlePrevFeedbackClick: () => void;
    handleNextFeedbackClick: () => void;
    focusOnBlockAtIndex: (index: number) => void;
}
interface EditorToolbarFeedbackNavState {
}
class EditorToolbarFeedbackNav extends React.Component<EditorToolbarFeedbackNavProps, EditorToolbarFeedbackNavState> {
    constructor(props: EditorToolbarFeedbackNavProps) {
        super(props);
    }

    render() {
        return this.props.blocksWithFeedback?.length ? (
            <div className="ui feedback-nav-container">
                <Button
                    leftIcon="fas fa-arrow-left"
                    // label={"<"}
                    className="blue feedback-nav-btn"
                    title={lf("Previous Feedback")}
                    onClick={this.props.handlePrevFeedbackClick}
                />
                <div className="feedback-nav-text">{lf("Feedback")}</div>
                <Button
                    leftIcon="fas fa-arrow-right"
                    // label={">"}
                    className="blue feedback-nav-btn"
                    title={lf("Next Feedback")}
                    onClick={this.props.handleNextFeedbackClick}
                />
            </div>
        ) : null;
    }
}
