import { useCallback, useState } from "react";
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

    const handleKeyDown = (ev: React.KeyboardEvent) => {
        if (GamepadManager.isGamepadManagerEvent(ev)) {
            return;
        }
        const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
        if (control === GamepadManager.GamepadControl.AButton) {
            ev.preventDefault();
            ev.stopPropagation();
            onClick?.();
        }
    };

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

    return (
        <>
            <button
                className={classes}
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                ref={handleRef}
            >
                {children}
            </button>
        </>
    );
};

export default GenericButton;
