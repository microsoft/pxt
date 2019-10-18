import { rangeToSelection } from "./monaco";

// Known limitations:
//  - Any time we use an edit amendment, the user's undo stack will have a superfluous entry.
//    For example, the undo stack for player.on_chat will look like:
//      After edit:
//          def on_chat_handler():
//              pass
//          player.on_chat(on_chat_handler)
//      1st undo:
//          player.
//      2nd undo:
//          player.on_cha
//    We could remove this extra entry if Monaco gave us a way to pop items from the undo stack,
//    or better yet if it supported our scenarios so that we didn't need edit amendments.
//  - The user may see a flicker of "#AMENDMENT:..." after completing a snippet

// TODO(dz):
export interface EditAmendment {
    delLeft: number,
    insertText: string,
}
type EditAmendmentInstance = {
    range: monaco.IRange
} & EditAmendment
const amendmentMarker = `#AMENDMENT:` // TODO: generalize for TS if needed

export function createLineReplacementPyAmendment(insertPosition: monaco.Position, insertText?: string): EditAmendment {
    return {
        delLeft: insertPosition.column - 1,
        insertText: insertText || "",
    }
}
export function amendmentToInsertSnippet(amendment: EditAmendment): string {
    if (amendment.delLeft > 0)
        return `${amendmentMarker}${JSON.stringify(amendment)}`
    else
        return amendment.insertText
}

function scanForEditAmendment(e: monaco.editor.IModelContentChangedEvent): EditAmendmentInstance | null {
    if (e.changes.length != 1)
        return null
    let change = e.changes[0]
    let hasAmendment = change.text.indexOf(amendmentMarker) >= 0
    if (!hasAmendment)
        return null
    let textAndAmendment = change.text.split(amendmentMarker)
    if (textAndAmendment.length != 2) {
        // Useful for debugging:
        // console.error("Incorrect text ammendment: ")
        // console.dir(change)
        return null
    }
    let preText = textAndAmendment[0]
    let amendmentStr = textAndAmendment[1]
    let amendment = pxt.U.jsonTryParse(amendmentStr) as EditAmendment
    if (!amendment) {
        // Useful for debugging:
        // console.error("Incorrect text ammendment JSON: ")
        // console.dir(amendmentStr)
        return null
    }
    return Object.assign({
        range: change.range
    }, amendment)
}

export function listenForEditAmendments(editor: monaco.editor.IStandaloneCodeEditor) {
    editor.onDidChangeModelContent(e => {

        let amendment = scanForEditAmendment(e)
        if (!amendment)
            return

        let amendRange = Object.assign({}, amendment.range)
        let changeText = amendment.insertText
        const MAX_COLUMN_LENGTH = 99999
        amendRange.endColumn = MAX_COLUMN_LENGTH
        let changeLines = changeText.split("\n").length - 1
        // amendRange.endLineNumber += changeLines
        if (amendment.delLeft) {
            amendRange.startColumn = Math.max(amendRange.startColumn - amendment.delLeft, 1)
        }

        setTimeout(() => {
            let newText = changeText
            let range = amendRange
            return new Promise(resolve => {
                const model = editor.getModel();
                let afterRange: monaco.Range = null;
                let passSplits = newText.split("pass")
                if (passSplits.length >= 2) {
                    // TODO(dz): generalize
                    let before = passSplits[0]
                    let beforeLines = before.split("\n");
                    let pass = "pass"
                    let lastBeforeLine = beforeLines[beforeLines.length - 1]
                    let passLine = range.startLineNumber + beforeLines.length - 1
                    let startCol = lastBeforeLine.length + 1

                    afterRange = new monaco.Range(passLine, startCol,
                        passLine, startCol + pass.length)
                }

                let reverseRange = Object.assign({}, amendment.range)
                reverseRange.endColumn = 9999 // TODO(dz) ?

                let undoEdits: monaco.editor.IIdentifiedSingleEditOperation[] = [{
                    identifier: { major: 0, minor: 0 },
                    range: model.validateRange(reverseRange),
                    text: "",
                    forceMoveMarkers: false,
                    isAutoWhitespaceEdit: false
                }]
                model.applyEdits(undoEdits)

                setTimeout(() => {
                    const disposable = editor.onDidChangeModelContent(e => {
                        let changes = e.changes;

                        disposable.dispose();
                        if (afterRange)
                            editor.setSelection(afterRange);

                        if (afterRange)
                            resolve(afterRange);
                    });

                    let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [{
                        identifier: { major: 0, minor: 0 },
                        range: model.validateRange(range),
                        text: newText,
                        forceMoveMarkers: true,
                        isAutoWhitespaceEdit: true
                    }]
                    model.pushEditOperations(editor.getSelections(), edits, inverseOp => [rangeToSelection(inverseOp[0].range)])
                }, 0);


            });
        }, 0) // end setTimeout
    });
}