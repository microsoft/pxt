import * as React from "react";
import * as Blockly from "blockly";
import { CONTROL_KEY_SHORT, getShortcutKeysShortAll, LIST_SHORTCUTS_SHORTCUT } from "../shortcut_formatting";
import { jsxLF } from "../../../react-common/components/util";

const names = Blockly.ShortcutItems.names;
const isMacPlatform = pxt.BrowserUtils.isMac();

const KeyboardControlsHelp = () => {
    const ref = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        ref.current?.focus()
    }, []);
    const ctrl = CONTROL_KEY_SHORT;
    const cmd = isMacPlatform ? "⌘" : ctrl;
    const orAsJoiner = lf("or")
    const enterOrSpace = { shortcuts: getShortcutKeysShortAll(names.PERFORM_ACTION), joiner: orAsJoiner}
    return (
        <aside id="keyboardnavhelp" aria-label={lf("Keyboard Controls")} ref={ref} tabIndex={0}>
            <h2>{lf("Keyboard Controls")}</h2>
            <h3>{lf("Global")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Show/hide shortcut help")} shortcuts={[LIST_SHORTCUTS_SHORTCUT]} />
                    <Row name={lf("Move between menus, simulator and the workspace")} shortcuts={[[lf("{id:keyboard symbol}Tab")], [lf("{id:keyboard symbol}Shift"), lf("{id:keyboard symbol}Tab")]]} joiner="row"/>
                    <Row name={lf("Area menu")} shortcuts={[[cmd, "B"]]}>
                        <p className="hint">{lf("Then press an area's number, or Tab to it and press Enter")}</p>
                    </Row>
                </tbody>
            </table>
            <h3>{lf("Blocks Workspace")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Navigate blocks")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN, names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Next block stack")} shortcuts={[names.NEXT_STACK]} />
                    <Row name={lf("Previous block stack")} shortcuts={[names.PREVIOUS_STACK]} />
                    <Row name={lf("Select workspace")} shortcuts={[names.FOCUS_WORKSPACE]} />
                    <Row name={lf("Context menu")} shortcuts={[names.MENU]} />
                    <Row name={lf("Format code")} shortcuts={[names.CLEANUP]} />
                    <Row name={lf("Undo / redo")} shortcuts={[names.UNDO, names.REDO]} joiner="/" />
                    {pxt.canDownload() &&
                        <Row name={lf("Download your code to the {0}", pxt.appTarget.appTheme.boardName)} shortcuts={[["L"]]} />}
                    <Row name={lf("Toolbox")} shortcuts={[names.FOCUS_TOOLBOX]} />
                    {pxt.appTarget.simulator &&
                        <Row name={lf("Start or stop simulator")} shortcuts={[["S"]]} />}
                    <Row name={lf("Screen reader mode")} shortcuts={[names.TOGGLE_SCREENREADER]}>
                        <p className="hint">{lf("Additional audio cues and navigation aids for screen reader users")}</p>
                    </Row>
                </tbody>
            </table>
            <h3>{lf("Toolbox")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move in and out of categories")} shortcuts={[names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Navigate categories or blocks")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN]} />
                    <Row name={lf("Insert block")} {...enterOrSpace} />
                    <Row name={lf("Next / previous heading")} shortcuts={[names.NEXT_HEADING, names.PREVIOUS_HEADING]} joiner="/" />
                </tbody>
            </table>
            <h3>{lf("Selected Block")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move in and out of a block")} shortcuts={[names.NAVIGATE_RIGHT, names.NAVIGATE_LEFT]} />
                    <Row name={lf("Edit or confirm")} {...enterOrSpace} />
                    <Row name={lf("Cancel or exit")} shortcuts={[names.ESCAPE]} />
                    <Row name={lf("Move mode")} shortcuts={[names.START_MOVE]} />
                    <Row name={lf("Move mode for a stack")} shortcuts={[names.START_MOVE_STACK]} />
                    <Row name={lf("Copy / paste")} shortcuts={[names.COPY, names.PASTE]} joiner="/" />
                    <Row name={lf("Cut")} shortcuts={[names.CUT]} />
                    <Row name={lf("Duplicate")} shortcuts={[names.DUPLICATE]} />
                    <Row name={lf("Disconnect block")} shortcuts={[names.DISCONNECT]} />
                    <Row name={lf("Delete")} shortcuts={getShortcutKeysShortAll(names.DELETE)} joiner={orAsJoiner} />
                    <Row name={lf("Screen reader: More block info")} shortcuts={[names.INFORMATION]} />
                    <Row name={lf("Screen reader: Container block info")} shortcuts={[names.EXTENDED_INFORMATION]} />
                </tbody>
            </table>
            <h3>{lf("Move Mode")}</h3>
            <table>
                <tbody>
                    <Row name={lf("Move to positions")} shortcuts={[names.NAVIGATE_UP, names.NAVIGATE_DOWN, names.NAVIGATE_LEFT, names.NAVIGATE_RIGHT]} />
                    <Row name={lf("Move anywhere")}>
                        {jsxLF(lf("Hold {0} and press arrow keys"), <Key value={cmd} />)}
                    </Row>
                    <Row name={lf("Confirm")} {...enterOrSpace} />
                    <Row name={lf("Cancel")} shortcuts={[names.ABORT_MOVE]} />
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
        case CONTROL_KEY_SHORT: {
            aria = Blockly.Msg['CONTROL_KEY'];
            break;
        }
    }
    return <span className="key" aria-label={aria}>{value}</span>
}

export default KeyboardControlsHelp;
