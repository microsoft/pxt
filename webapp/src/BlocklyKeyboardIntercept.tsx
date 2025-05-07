import * as Blockly from 'blockly';
import { useEffect, useRef } from "react"

interface BlocklyKeyboardInterceptProps {
    keyCodes: number[];
    children: React.ReactNode;
}

const SHORTCUT_NAME = "temporary_makecode_key_suspensions";

/**
 * Top-level Blockly handlers for escape and enter interfere with standard 
 * keyboard controls for navigating dropdowns. This temporarily suspends
 * the effect when any of its children have focus.
 */
const suspendBlocklyKeyHandlers = (keyCodes: number[]) => {
    const keyBlockHandler: Blockly.ShortcutRegistry.KeyboardShortcut = {
        name: SHORTCUT_NAME,
        allowCollision: true,
        callback: () => true,
        keyCodes,
    };

    Blockly.ShortcutRegistry.registry.register(keyBlockHandler);
}

const reinstateBlocklyKeyHandlers = () => {
    Blockly.ShortcutRegistry.registry.unregister(SHORTCUT_NAME);
}

export const BlocklyKeyboardIntercept = ({children, keyCodes}: BlocklyKeyboardInterceptProps) => {
    const keysSuspended = useRef<boolean>(false);

    useEffect(() =>
        () => { // when the component is destroyed, ensure it cleans up
            if (keysSuspended.current) {
                reinstateBlocklyKeyHandlers();
            }
        }, []);

    return <div
        onFocus={() => {
            // Unlike pure HTML, React synthetic focus and blur bubble up from children
            if (keysSuspended.current) return;
            suspendBlocklyKeyHandlers(keyCodes);
            keysSuspended.current = true;
        }}
        onBlur={() => {
            if (!keysSuspended.current) return;
            reinstateBlocklyKeyHandlers();
            keysSuspended.current = false;
        }}>
        {children}
    </div>
}
