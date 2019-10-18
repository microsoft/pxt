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
// Possible future issues:
//  - The implementation depends on using setTimeout() as a way to wait for Monaco, because
//    onDidChangeModelContent event notifies us before the change is applied to the buffer
//    presumably as a way to give us a chance to react somehow, however to apply another edit
//    we have to wait for the first edit to be applied, thus we use setTimeout().
//    However in most cases when you use setTimeout(), it's likely that you may be susceptible to
//    race conditions, especially if anyone else is listening onDidChangeModelContent and using
//    setTimeout().

export interface EditAmendment {
    behavior: "replaceLine",
    insertText: string,
}
type EditAmendmentInstance = {
    range: monaco.IRange
} & EditAmendment
const amendmentMarker = `#AMENDMENT:` // TODO: generalize for TS if needed

export function createLineReplacementPyAmendment(insertPosition: monaco.Position, insertText?: string): EditAmendment {
    return {
        behavior: "replaceLine",
        insertText: insertText || "",
    }
}
export function amendmentToInsertSnippet(amendment: EditAmendment): string {
    return `${amendmentMarker}${JSON.stringify(amendment)}`
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

// TODO(dz): handle indent
function applyAmendment(amendment: EditAmendmentInstance, editor: monaco.editor.IStandaloneCodeEditor) {
    setTimeout(() => { // see top of file comments about why use setTimeout
        let amendRange = Object.assign({}, amendment.range)
        if (amendment.behavior === "replaceLine") {
            const MAX_COLUMN_LENGTH = 99999
            amendRange.endColumn = MAX_COLUMN_LENGTH // clunky way to select a whole line
            amendRange.startColumn = 1
        } else {
            let _: never = amendment.behavior;
        }

        let newText = amendment.insertText
        // return new Promise(resolve => {
        const model = editor.getModel();
        let afterRange: monaco.Range = null;
        let passSplits = newText.split("pass")
        if (passSplits.length >= 2) {
            // TODO(dz): generalize
            let before = passSplits[0]
            let beforeLines = before.split("\n");
            let pass = "pass"
            let lastBeforeLine = beforeLines[beforeLines.length - 1]
            let passLine = amendRange.startLineNumber + beforeLines.length - 1
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

                // if (afterRange)
                //     resolve(afterRange);
            });

            let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [{
                identifier: { major: 0, minor: 0 },
                range: model.validateRange(amendRange),
                text: newText,
                forceMoveMarkers: true,
                isAutoWhitespaceEdit: true
            }]
            model.pushEditOperations(editor.getSelections(), edits, inverseOp => [rangeToSelection(inverseOp[0].range)])
        }, 0);
    }, 0)
}

export function listenForEditAmendments(editor: monaco.editor.IStandaloneCodeEditor) {
    editor.onDidChangeModelContent(e => {

        let amendment = scanForEditAmendment(e)
        if (!!amendment)
            applyAmendment(amendment, editor)
    });
}