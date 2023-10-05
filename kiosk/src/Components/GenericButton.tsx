import { useCallback, useEffect, useState } from "react";
import { useMakeNavigable } from "../Hooks";
import { classList } from "../Utils";
import * as GamepadManager from "../Services/GamepadManager";
import * as NavGrid from "../Services/NavGrid";

interface IProps extends React.PropsWithChildren<{}> {
    className?: string;
    classNameReplace?: string;
    autofocus?: boolean;
    onClick?: (ev?: React.MouseEvent) => void;
    exitDirections?: NavGrid.NavDirection[];
}

const GenericButton: React.FC<IProps> = ({
    children,
    className,
    classNameReplace,
    autofocus,
    onClick,
    exitDirections,
}) => {
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

    const handleClick = (ev: React.MouseEvent) => {
        onClick?.(ev);
    };

    const handleRef = useCallback((node: HTMLElement | null) => {
        setMyRef(node);
    }, []);

    useMakeNavigable(myRef, { autofocus, exitDirections });

    const classes = classList(
        classNameReplace ? classNameReplace : "kioskButton",
        className
    );

    useEffect(() => {
        GamepadManager.addKeydownListener(handleKeyDown);
        return () => GamepadManager.removeKeydownListener(handleKeyDown);
    });

    return (
        <>
            <button
                className={classes}
                tabIndex={0}
                onClick={handleClick}
                ref={handleRef}
            >
                {children}
            </button>
        </>
    );
};

export default GenericButton;
