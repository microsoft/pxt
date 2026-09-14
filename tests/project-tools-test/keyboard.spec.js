"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function keyboardEnvironment() {
    const listeners = [];
    class Element {
        constructor(parent, editable = false) { this.parentElement = parent; this.editable = editable; }
        contains(node) { return node === this || !!node?.parentElement && this.contains(node.parentElement); }
        closest() { return this.editable ? this : this.parentElement?.closest(); }
    }
    const actions = new Proxy({}, { get: (_target, name) => (...args) => ({ type: name, args }) });
    const mainStore = { dispatch() {}, getState: () => ({ editor: {} }) };
    const context = vm.createContext({
        Node: Element, Element,
        document: {
            addEventListener: (type, callback, capture) => listeners.push({ type, callback, capture }),
            removeEventListener: (type, callback, capture) => {
                const index = listeners.findIndex(l => l.type === type && l.callback === callback && l.capture === capture);
                if (index >= 0) listeners.splice(index, 1);
            }
        }
    });
    const exports = {};
    const code = fs.readFileSync("built/webapp/src/components/ImageEditor/keyboardShortcuts.js", "utf8");
    vm.runInContext(`(function(require, exports) { ${code}\n})`, context)(id => {
        if (id === "./actions/dispatch") return actions;
        if (id === "./store/imageStore") return { mainStore };
        if (id === "./store/imageReducer") return { ImageEditorTool: { Paint: 0, Erase: 3 } };
        return {};
    }, exports);
    const makeOwner = (scoped = true) => {
        const root = new Element();
        const dispatched = [];
        const store = { dispatch: action => dispatched.push(action), getState: () => ({ editor: {} }) };
        return { root, dispatched, remove: exports.addKeyListener(root, store, scoped) };
    };
    const send = (target, key, ctrlKey = false) => {
        const event = { target, key, ctrlKey, code: "", preventDefault() { this.prevented = true; }, stopPropagation() {} };
        for (const listener of listeners.slice().sort((a, b) => !!b.capture - !!a.capture)) listener.callback(event);
        return event;
    };
    return { exports, Element, listeners, makeOwner, send };
}

describe("image-editor shortcut ownership", () => {
    it("does not capture undo or tool keys outside an inline whiteboard", () => {
        const env = keyboardEnvironment(); const whiteboard = env.makeOwner();
        assert.equal(env.send(new env.Element(), "z", true).prevented, undefined);
        env.send(new env.Element(), "e");
        assert.equal(whiteboard.dispatched.length, 0);
        whiteboard.remove();
    });

    it("routes undo and tool keys to the focused editor's own store", () => {
        const env = keyboardEnvironment(); const a = env.makeOwner(); const b = env.makeOwner();
        env.send(new env.Element(a.root), "z", true);
        env.send(new env.Element(b.root), "e");
        assert.equal(a.dispatched[0].type, "dispatchUndoImageEdit");
        assert.equal(b.dispatched[0].type, "dispatchChangeImageTool");
        assert.equal(a.dispatched.length, 1); assert.equal(b.dispatched.length, 1);
    });

    it("leaves editable fields' text undo and deletion alone", () => {
        const env = keyboardEnvironment(); const owner = env.makeOwner();
        const input = new env.Element(owner.root, true);
        assert.equal(env.send(input, "z", true).prevented, undefined);
        env.send(input, "Delete"); env.send(input, "e");
        assert.equal(owner.dispatched.length, 0);
    });

    it("unmounting one editor preserves the other editor's listeners", () => {
        const env = keyboardEnvironment(); const a = env.makeOwner(); const b = env.makeOwner(false);
        assert.equal(env.listeners.length, 3);
        b.remove(); env.send(new env.Element(a.root), "z", true);
        assert.equal(a.dispatched.length, 1); assert.equal(env.listeners.length, 3);
        a.remove(); assert.equal(env.listeners.length, 0);
    });

    it("retains nested modal shortcut behavior and restores its parent", () => {
        const env = keyboardEnvironment(); const parent = env.makeOwner(false); const nested = env.makeOwner(false);
        env.send(new env.Element(), "z", true);
        assert.equal(nested.dispatched.length, 1); assert.equal(parent.dispatched.length, 0);
        nested.remove(); env.send(new env.Element(), "z", true);
        assert.equal(parent.dispatched.length, 1);
    });

    it("honors and releases temporary shortcut locks", () => {
        const env = keyboardEnvironment(); const owner = env.makeOwner();
        const lock = env.exports.obtainShortcutLock();
        env.send(new env.Element(owner.root), "z", true); assert.equal(owner.dispatched.length, 0);
        env.exports.releaseShortcutLock(lock);
        env.send(new env.Element(owner.root), "z", true); assert.equal(owner.dispatched.length, 1);
    });
});