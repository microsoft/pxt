import * as Blockly from "blockly";

// validates that one or more blocks comments are in the project
// returns the blocks that have comments for teacher tool scenario
export function validateBlockCommentsExist({ usedBlocks, numRequired }: {
    usedBlocks: Blockly.Block[],
    numRequired: number,
}): {
    commentedBlocks: Blockly.Block[],
    passed: boolean
} {
    const commentedBlocks = getCommentedBlocks(usedBlocks);
    return { commentedBlocks, passed: commentedBlocks.length >= numRequired };
}

function getCommentedBlocks(usedBlocks: Blockly.Block[]): Blockly.Block[] {
    return usedBlocks.filter((block) => !!block.getCommentText());
}

export function validateWorkspaceCommentsExist({ usedBlocks, numRequired }: {
    usedBlocks: Blockly.Block[],
    numRequired: number,
}): {
    workspaceComments: Blockly.comments.WorkspaceComment[],
    passed: boolean
} {
    const workspaceComments = getWorkspaceComments(usedBlocks);
    return { workspaceComments, passed: workspaceComments.length >= numRequired };
}

function getWorkspaceComments(usedBlocks: Blockly.Block[]): Blockly.comments.WorkspaceComment[] {
    const workspace = usedBlocks[0]?.workspace;
    const topComments = workspace?.getTopComments() ?? [];
    return topComments.filter(comment => !!comment.getText());
}

export function validateCommentsExist({ usedBlocks, numRequired }: {
    usedBlocks: Blockly.Block[],
    numRequired: number,
}): {
    comments: (Blockly.Block | Blockly.comments.WorkspaceComment)[],
    passed: boolean
} {
    const commentedBlocks = getCommentedBlocks(usedBlocks);
    const workspaceComments = getWorkspaceComments(usedBlocks);
    const allComments: (Blockly.Block | Blockly.comments.WorkspaceComment)[] = [
        ...commentedBlocks,
        ...workspaceComments
    ];
    return { comments: allComments, passed: allComments.length >= numRequired };
}
