import * as React from "react";
import * as Blockly from "blockly";
import { getShortcutKeysShortAll, LIST_SHORTCUTS_SHORTCUT } from "../shortcut_formatting";

const names = Blockly.ShortcutItems.names;
const isMacPlatform = pxt.BrowserUtils.isMac();

const KeyboardControlsHelp = () => {
    const ref = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        ref.current?.focus()
    }, []);
    const ctrl = lf("{id:keyboard symbol}Ctrl");
    const cmd = isMacPlatform ? "⌘" : ctrl;
    const contextMenuRow = <Row name={lf("Open context menu")} shortcuts={[names.MENU]} />
    const cleanUpRow = <Row name={lf("Workspace: Format code")} shortcuts={[names.CLEANUP]} />
    const orAsJoiner = lf("or")
    const enterOrSpace = { shortcuts: getShortcutKeysShortAll(names.PERFORM_ACTION), joiner: orAsJoiner}
    const editOrConfirmRow = <Row name={lf("Edit or confirm")} {...enterOrSpace} />
    return (
        <aside id="keyboardnavhelp" aria-label={lf("Keyboard Controls")} ref={ref} tabIndex={0}>
            <h2>{lf("Keyboard Controls")}</h2>
            <table>
                <tbody>
                    <Row name={lf("Show/hide shortcut help")} shortcuts={[LIST_SHORTCUTS_SHORTCUT]} />
                    <Row name={lf("Open/close area menu")} shortcuts={[[cmd, "B"]]} />
                    <Row name={lf("Block and toolbox navigation")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN, names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Toolbox")} shortcuts={[names.FOCUS_TOOLBOX]} />
                    {editOrConfirmRow}
                    <Row name={lf("Move mode")} shortcuts={[names.START_MOVE]} >
                        <p className="hint">{lf("Press arrow keys to move to connections")}</p>
                        <p className="hint">{lf("Hold {0} to move anywhere", cmd)}</p>
                    </Row>
                    <Row name={lf("Copy / paste")} shortcuts={[names.COPY, names.PASTE]} joiner="/" />
                    {cleanUpRow}
                    {contextMenuRow}
                </tbody>
            </table>
            <h3>{lf("Editor Overview")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move between menus, simulator and the workspace")} shortcuts={[[lf("{id:keyboard symbol}Tab")], [lf("{id:keyboard symbol}Shift"), lf("{id:keyboard symbol}Tab")]]} joiner="row"/>
                    <Row name={lf("Open/close area menu")} shortcuts={[[cmd, "B"]]} />
                    <Row name={lf("Exit")} shortcuts={[names.ESCAPE]} />
                    <Row name={lf("Toolbox")} shortcuts={[names.FOCUS_TOOLBOX]} />
                    <Row name={lf("Toolbox: Move in and out of categories")} shortcuts={[names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Toolbox: Navigate categories or blocks")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN]} />
                    <Row name={lf("Toolbox: Insert block")} {...enterOrSpace} />
                    <Row name={lf("Workspace: Select workspace")} shortcuts={[names.FOCUS_WORKSPACE]} />
                    {cleanUpRow}
                    <Row name={lf("Next block stack")} shortcuts={[names.NEXT_STACK]} />
                    <Row name={lf("Previous block stack")} shortcuts={[names.PREVIOUS_STACK]} />
                </tbody>
            </table>
            <h3>{lf("Edit Blocks")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move in and out of a block")} shortcuts={[names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    {editOrConfirmRow}
                    <Row name={lf("Cancel or exit")} shortcuts={[names.ESCAPE]} />
                    <Row name={lf("Copy")} shortcuts={[names.COPY]} />
                    <Row name={lf("Paste")} shortcuts={[names.PASTE]} />
                    <Row name={lf("Cut")} shortcuts={[names.CUT]} />
                    <Row name={lf("Duplicate")} shortcuts={[names.DUPLICATE]} />
                    <Row name={lf("Delete")} shortcuts={getShortcutKeysShortAll(names.DELETE)} joiner={orAsJoiner} />
                    <Row name={lf("Undo")} shortcuts={[names.UNDO]} />
                    <Row name={lf("Redo")} shortcuts={[names.REDO]} />
                    {contextMenuRow}
                </tbody>
            </table>
            <h3>{lf("Moving Blocks")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move mode")} shortcuts={[names.START_MOVE]} />
                    <Row name={lf("Move mode: Move to connections")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN, names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Move mode: Move anywhere")}>
                        {lf("Hold {0} and press arrow keys", cmd)}
                    </Row>
                    <Row name={lf("Move mode: Confirm")} {...enterOrSpace} />
                    <Row name={lf("Move mode: Cancel")} shortcuts={[names.ABORT_MOVE]} />
                    <Row name={lf("Disconnect block")} shortcuts={[names.DISCONNECT]} />
                </tbody>
            </table>
        </aside>
    );
}

const Shortcut = ({ keys }: { keys: string[] }) => {
    const joiner = isMacPlatform ? " " : " + "
    return (
        <span className="shortcut">
            {keys.reduce((acc, key) => {
                return acc.length === 0
                    ? [...acc,  <Key key={key} value={key} />]
                    : [...acc, joiner, <Key key={key} value={key} />]
            }, [])}
        </span>
    );
}

interface RowProps {
    name: string;
    shortcuts?: Array<string | string[]>;
    joiner?: string;
    children?: React.ReactNode;
}

const Row = ({ name, shortcuts = [], joiner, children}: RowProps) => {
    const shortcutElements = shortcuts.map((s, idx) => {
        if (typeof s === "string") {
            // Pull keys from shortcut registry.
            const variants = getShortcutKeysShortAll(s);
            return variants.length === 0 ? null : <Shortcut key={idx} keys={variants[0]} />
        } else {
            // Display keys as specified.
            return <Shortcut key={idx} keys={s} />
        }
    })
    return joiner === "row" ? (
        <>
            <tr>
                <td width="50%" rowSpan={shortcuts.length}>{name}</td>
                <td width="50%">
                    {shortcutElements[0]}
                </td>
            </tr>
            {shortcutElements.map((el, idx) => idx === 0
                ? undefined
                : (<tr key={idx}>
                        <td width="50%">
                            {el}
                        </td>
                    </tr>))}
        </>
    ) : (
        <tr>
            <td width="50%">{name}</td>
            <td width="50%">
                {shortcutElements.reduce((acc, shortcut) => {
                    return acc.length === 0
                        ? [...acc,  shortcut]
                        : [...acc, joiner ? ` ${joiner} ` : " ", shortcut]
                }, [])}
                {children}
            </td>
        </tr>
    )
}

const Key = ({ value }: { value: string }) => {
    let aria;
    switch (value) {
        case "↑": {
            aria = lf("Up Arrow");
            break;
        }
        case "↓": {
            aria = lf("Down Arrow");
            break;
        }
        case "←": {
            aria = lf("Left Arrow");
            break;
        }
        case "→": {
            aria = lf("Right Arrow");
            break;
        }
        case "⌘": {
            aria = lf("Command");
            break;
        }
        case "⌥": {
            aria = lf("Option");
            break;
        }
    }
    return <span className="key" aria-label={aria}>{value}</span>
}

export default KeyboardControlsHelp;
