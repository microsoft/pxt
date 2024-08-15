import * as React from "react";
import css from "./styling/SignedOutPanel.module.scss";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { showModal } from "../transforms/showModal";
import { Ticks } from "../constants";

// This component should never really be visible, but it exists as a fallback
// in case the sign-in modal is ever closed unexpectedly.
interface IProps {}
export const SignedOutPanel: React.FC<IProps> = () => {
    return (
        <div className={css["signed-out-container"]}>
            <div className={css["signed-out-panel"]}>
                <h1>{lf("Sign In Required")}</h1>
                <div>{lf("Sign in is required to use this tool.")}</div>
                <Button
                    className={classList("primary", css["sign-in-button"])}
                    rightIcon="xicon cloud-user"
                    title={lf("Sign In")}
                    label={lf("Sign In")}
                    onClick={() => {
                        pxt.tickEvent(Ticks.SignedOutPanelSignIn);
                        showModal({ modal: "sign-in" });
                    }}
                />
            </div>
        </div>
    );
};
