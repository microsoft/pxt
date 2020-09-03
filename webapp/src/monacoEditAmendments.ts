import { rangeToSelection } from "./monaco";
import { fixIndentationInRange } from "./monacopyhelper";

// This file adds a feature to Monaco I (dz) call "Edit Amendments".
// EditAmendments are used by the auto-complete system as a work around for limitations in Monaco.
// Worked example:
//      Consider if a user starts typing this (in Minecraft py):
//          player.on_cha
//      Our auto-complete suggestion would be:
//          player.on_chat
//      And the snippet we want to insert is:
//          def on_chat_handler():
//              pass
//          player.on_chat(on_chat_handler)
//      The problem is that Monaco would paste this snippet as:
//          player.def on_chat_handler():
//              pass
//          player.on_chat(on_chat_handler)
//      And there's no way I've found to remove the "player." prefix.
//      Note that we don't have this issue in typescript because of inline callbacks:
//          player.on_chat(() => {
//
//          })
//      So the system basically sticks a json payload at the end of the snippet insertion:
//          player.on_chat#AMENDMENT{behavior: "replaceLine", insertText: "def on_chat_handler(): ..." }
//      which we then sniff for in the onDidChangeModelContent event and apply the changes.
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
    selectText?: string,
}
interface EditAmendmentInstance extends EditAmendment {
    range: monaco.IRange
}
const amendmentMarker = `#AMENDMENT:` // TODO: generalize for TS if needed

export function createLineReplacementPyAmendment(insertText?: string, selectText: string = "pass"): EditAmendment {
    return {
        behavior: "replaceLine",
        insertText: insertText || "",
        selectText: selectText
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

function applyAmendment(amendment: EditAmendmentInstance, editor: monaco.editor.IStandaloneCodeEditor) {
    const model = editor.getModel();

    const MAX_COLUMN_LENGTH = 99999 // clunky way to select a whole line
    setTimeout(() => { // see top of file comments about why use setTimeout
        // determine where to apply
        let amendRange = amendment.range
        if (amendment.behavior === "replaceLine") {
            amendRange = {
                ...amendRange,
                endColumn: MAX_COLUMN_LENGTH,
                startColumn: 1
            };
        } else {
            let _: never = amendment.behavior;
        }

        const corrected = fixIndentationInRange(model, model.validateRange(amendRange), amendment.insertText)[0];
        amendment.range = corrected.range;
        amendment.insertText = corrected.text;

        // determine selection range after applying
        let afterRange: monaco.Range | null = null;
        if (amendment.selectText) {
            let selectSplits = amendment.insertText.split(amendment.selectText)
            if (selectSplits.length >= 2) {
                let before = selectSplits[0]
                let beforeLines = before.split("\n");
                let lastBeforeLine = beforeLines[beforeLines.length - 1]
                let selectLine = amendRange.startLineNumber + beforeLines.length - 1
                let startCol = lastBeforeLine.length + 1

                afterRange = new monaco.Range(selectLine, startCol,
                    selectLine, startCol + amendment.selectText.length)
            }
        }


        // remove the amendment so it doesn't appear in the undo stack
        let reverseRange = {
            ...amendment.range,
            endColumn: MAX_COLUMN_LENGTH
        }
        let undoEdits: monaco.editor.IIdentifiedSingleEditOperation[] = [{
            range: model.validateRange(reverseRange),
            text: "",
            forceMoveMarkers: false
        }]
        model.applyEdits(undoEdits)

        setTimeout(() => {
            // prepare to select the appropriate text afterwards, probably "pass"
            const disposable = editor.onDidChangeModelContent(e => {
                disposable.dispose();
                if (afterRange)
                    editor.setSelection(afterRange);
            });

            // apply the amendment
            let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [{
                range: model.validateRange(amendRange),
                text: amendment.insertText,
                forceMoveMarkers: true
            }]
            model.pushEditOperations(editor.getSelections(), edits, inverseOp => [rangeToSelection(inverseOp[0].range)])
        }, 0);
    }, 0)
}

export function listenForEditAmendments(editor: monaco.editor.IStandaloneCodeEditor) {
    return editor.onDidChangeModelContent(e => {

        let amendment = scanForEditAmendment(e)
        if (amendment)
            applyAmendment(amendment, editor)
    });
}
