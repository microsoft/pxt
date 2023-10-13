import { useCallback, useEffect, useState } from "react";
import { useMakeNavigable } from "../Hooks";
import { classList } from "../Utils";
import * as GamepadManager from "../Services/GamepadManager";
import * as NavGrid from "../Services/NavGrid";
import {
    Button,
    ButtonProps,
} from "../../../react-common/components/controls/Button";

interface IProps extends ButtonProps {
    classNameReplace?: string;
    autofocus?: boolean;
    exitDirections?: NavGrid.NavDirection[];
}

const GenericButton: React.FC<IProps> = (props: IProps) => {
    const {
        children,
        className,
        classNameReplace,
        autofocus,
        onClick,
        exitDirections,
    } = props;

    const tabIndex = props.tabIndex !== undefined ? props.tabIndex : 0;

    const classes = classList(
        classNameReplace ? classNameReplace : "kioskButton",
        className
    );

    const [myRef, setMyRef] = useState<HTMLElement | null>(null);

    const handleKeyDown = useCallback(
        (ev: KeyboardEvent) => {
            if (ev.target !== myRef) {
                return;
            }
            const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
            if (control === GamepadManager.GamepadControl.AButton) {
                ev.preventDefault();
                ev.stopPropagation();
                onClick?.();
            }
        },
        [myRef]
    );

    const handleRef = useCallback((node: HTMLElement | null) => {
        setMyRef(node);
    }, []);

    useMakeNavigable(myRef, { autofocus, exitDirections, tabIndex });

    useEffect(() => {
        GamepadManager.addKeydownListener(handleKeyDown);
        return () => GamepadManager.removeKeydownListener(handleKeyDown);
    });

    return (
        <>
            <Button
                className={classes}
                tabIndex={tabIndex}
                buttonRef={handleRef}
                {...props}
            >
                {children}
            </Button>
        </>
    );
};

export default GenericButton;
