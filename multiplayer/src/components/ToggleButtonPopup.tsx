import { useCallback, useRef } from "react";
import Popup, { PopupProps } from "./Popup";

interface ToggleButtonPopupProps extends PopupProps {
    button: JSX.Element;
}
export default function Render(props: ToggleButtonPopupProps) {
    const ref = useRef<Element | null>();
    const setRef = useCallback((el: Element | null) => {
        ref.current = el;
    }, []);

    return (
        <>
            <Popup
                className={props.className}
                visible={props.visible}
                onClickedOutside={props.onClickedOutside}
                children={props.children}
                triggerElementRef={props.triggerElementRef ?? ref}
            />
            <div ref={setRef}>{props.button}</div>
        </>
    );
}
