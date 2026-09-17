"use strict";

// This browser fixture uses the real React components and image reducer. Only
// the persistence and game-asset boundaries are supplied by the test runner.
const React = require("react");
const ReactDOM = require("react-dom");
const { ProjectTools } = require("../../built/webapp/src/components/ProjectTools");
const { imageStateToBitmap } = require("../../built/webapp/src/components/ImageEditor/util");
const { dispatchImageEdit, dispatchUndoImageEdit } = require("../../built/webapp/src/components/ImageEditor/actions/dispatch");
const { validateProjectNotes } = require("../../built/webapp/src/projectNotes");

window.DOMPurify = require("dompurify");

const test = window.whiteboardTest;
Object.assign(test.workspace, {
    async saveProjectNotesAsync(id, notes) {
        const snapshot = JSON.parse(JSON.stringify(validateProjectNotes(notes)));
        test.saves.push({ id, notes: snapshot });
        test.persisted = snapshot;
        test.receive(snapshot);
    }
});

function Harness({ notes }) {
    const [expanded, setExpanded] = React.useState(false);
    const [pinned, setPinned] = React.useState(false);
    const [incoming, setIncoming] = React.useState(notes);
    test.receive = setIncoming;
    return React.createElement(ProjectTools, {
        header: { id: "whiteboard-project" }, notes: incoming, expanded,
        pinned, onPinnedChange: setPinned,
        onSignIn: () => {},
        onExpandedChange: setExpanded, onOpenReference: () => {}, docsUrl: "/reference"
    });
}

test.mount = notes => {
    ReactDOM.unmountComponentAtNode(document.getElementById("root"));
    ReactDOM.render(React.createElement(Harness, { notes }), document.getElementById("root"));
};
test.unmount = () => ReactDOM.unmountComponentAtNode(document.getElementById("root"));
test.store = () => {
    const root = document.querySelector(".image-editor-outer");
    let fiber = root[Object.keys(root).find(key => key.startsWith("__reactFiber$"))];
    while (fiber && !fiber.stateNode?.getStore) fiber = fiber.return;
    return fiber.stateNode.getStore();
};
test.pixel = () => imageStateToBitmap(test.store().getState().store.present.frames[0]).get(0, 0);
test.draw = color => {
    const store = test.store();
    const bitmap = imageStateToBitmap(store.getState().store.present.frames[0]);
    bitmap.set(0, 0, color);
    store.dispatch(dispatchImageEdit({ bitmap: bitmap.data() }));
};
test.undo = () => test.store().dispatch(dispatchUndoImageEdit());
test.mount(test.initialNotes);