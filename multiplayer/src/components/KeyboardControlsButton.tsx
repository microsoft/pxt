import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import KeyboardControlsInfo from "./KeyboardControlsInfo";
import Popup from "./Popup";

export default function Render() {
    const [showKeys, setShowKeys] = useState(false);

    const onKeyboardControlsClicked = () => {
        pxt.tickEvent("mp.keyboardcontrols");
        setShowKeys(!showKeys);
    };

    return (
        <div>
            <Popup
                className="tw-absolute tw-translate-y-[-105%]"
                visible={showKeys}
                onClickedOutside={() => setShowKeys(false)}
            >
                <KeyboardControlsInfo />
            </Popup>
            <Button
                title={lf("Keyboard Controls")}
                label={lf("Keyboard Controls")}
                leftIcon="fas fa-keyboard"
                onClick={onKeyboardControlsClicked}
                className="tw-border-2 tw-border-slate-400 tw-border-solid tw-p-2 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms] tw-pr-1 sm:tw-pr-3"
            />
        </div>
    );
}
