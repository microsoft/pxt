import * as React from "react";
import { getActionShortcut, getActionShortcutsAsKeys, ShortcutNames } from "../shortcut_formatting";

const isMacPlatform = pxt.BrowserUtils.isMac();

const KeyboardControlsHelp = () => {
    const ref = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        ref.current?.focus()
    }, []);
    const ctrl = lf("Ctrl");
    const cmd = isMacPlatform ? "⌘" : ctrl;
    const optionOrCtrl = isMacPlatform ? "⌥" : ctrl;
    const contextMenuRow = <Row name={lf("Open context menu")} shortcuts={[ShortcutNames.MENU]} />
    const cleanUpRow = <Row name={lf("Workspace: Format code")} shortcuts={[ShortcutNames.CLEAN_UP]} />
    const orAsJoiner = lf("or")
    const enterOrSpace = { shortcuts: getActionShortcutsAsKeys(ShortcutNames.EDIT_OR_CONFIRM), joiner: orAsJoiner}
    const editOrConfirmRow = <Row name={lf("Edit or confirm")} {...enterOrSpace} />
    return (
        <aside id="keyboardnavhelp" aria-label={lf("Keyboard Controls")} ref={ref} tabIndex={0}>
            <h2>{lf("Keyboard Controls")}</h2>
            <table>
                <tbody>
                    <Row name={lf("Show/hide shortcut help")} shortcuts={[ShortcutNames.LIST_SHORTCUTS]} />
                    <Row name={lf("Open/close area menu")} shortcuts={[[cmd, "B"]]} />
                    <Row name={lf("Block and toolbox navigation")} shortcuts={[ShortcutNames.UP, ShortcutNames.DOWN, ShortcutNames.LEFT, ShortcutNames.RIGHT]} />
                    <Row name={lf("Toolbox")} shortcuts={[ShortcutNames.TOOLBOX]} />
                    {editOrConfirmRow}
                    <Row name={lf("Move mode")} shortcuts={[ShortcutNames.MOVE]} >
                        <p className="hint">{lf("Press arrow keys to move to connections")}</p>
                        <p className="hint">{lf("Hold {0} to move anywhere", optionOrCtrl)}</p>
                    </Row>
                    <Row name={lf("Copy / paste")} shortcuts={[ShortcutNames.COPY, ShortcutNames.PASTE]} joiner="/" />
                    {cleanUpRow}
                    {contextMenuRow}
                </tbody>
            </table>
            <h3>{lf("Editor Overview")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move between menus, simulator and the workspace")} shortcuts={[[lf("Tab")], [lf("Shift"), lf("Tab")]]} joiner="row"/>
                    <Row name={lf("Open/close area menu")} shortcuts={[[cmd, "B"]]} />
                    <Row name={lf("Exit")} shortcuts={[ShortcutNames.EXIT]} />
                    <Row name={lf("Toolbox")} shortcuts={[ShortcutNames.TOOLBOX]} />
                    <Row name={lf("Toolbox: Move in and out of categories")} shortcuts={[ShortcutNames.LEFT, ShortcutNames.RIGHT]} />
                    <Row name={lf("Toolbox: Navigate categories or blocks")} shortcuts={[ShortcutNames.UP, ShortcutNames.DOWN]} />
                    <Row name={lf("Toolbox: Insert block")} {...enterOrSpace} />
                    <Row name={lf("Workspace: Select workspace")} shortcuts={[ShortcutNames.CREATE_WS_CURSOR]} />
                    {cleanUpRow}
                </tbody>
            </table>
            <h3>{lf("Edit Blocks")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move in and out of a block")} shortcuts={[ShortcutNames.LEFT, ShortcutNames.RIGHT]} />
                    {editOrConfirmRow}
                    <Row name={lf("Cancel or exit")} shortcuts={[ShortcutNames.EXIT]} />
                    <Row name={lf("Copy")} shortcuts={[ShortcutNames.COPY]} />
                    <Row name={lf("Paste")} shortcuts={[ShortcutNames.PASTE]} />
                    <Row name={lf("Cut")} shortcuts={[ShortcutNames.CUT]} />
                    <Row name={lf("Delete")} shortcuts={getActionShortcutsAsKeys(ShortcutNames.DELETE)} joiner={orAsJoiner} />
                    <Row name={lf("Undo")} shortcuts={[ShortcutNames.UNDO]} />
                    <Row name={lf("Redo")} shortcuts={[ShortcutNames.REDO]} />
                    {contextMenuRow}
                </tbody>
            </table>
            <h3>{lf("Moving Blocks")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move mode")} shortcuts={[ShortcutNames.MOVE]} />
                    <Row name={lf("Move mode: Move to connections")} shortcuts={[ShortcutNames.UP, ShortcutNames.DOWN, ShortcutNames.LEFT, ShortcutNames.RIGHT]} />
                    <Row name={lf("Move mode: Move anywhere")}>
                        {lf("Hold {0} and press arrow keys", optionOrCtrl)}
                    </Row>
                    <Row name={lf("Move mode: Confirm")} {...enterOrSpace} />
                    <Row name={lf("Move mode: Cancel")} shortcuts={[ShortcutNames.EXIT]} />
                    <Row name={lf("Disconnect block")} shortcuts={[ShortcutNames.DISCONNECT]} />
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
            const shortcut = getActionShortcut(s);
            return shortcut === null ? null : <Shortcut key={idx} keys={getActionShortcut(s)} />
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