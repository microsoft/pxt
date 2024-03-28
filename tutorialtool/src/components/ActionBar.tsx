import * as React from "react";
import css from "./styling/ActionBar.module.scss";
import { MenuBar } from "react-common/components/controls/MenuBar";
import { Button } from "react-common/components/controls/Button";
import { previewCurrentTutorialAsync } from "../transforms/previewCurrentTutorialAsync";

interface IProps {

}

export const ActionBar: React.FC<IProps> = () => {
    const onRunCodeClick = React.useCallback(() => {
        previewCurrentTutorialAsync();
    }, []);

    return (
        <MenuBar className={css["action-bar"]}>
            <Button
                onClick={onRunCodeClick}
                label={lf("Run Code")}
                title={lf("Run Code")}
                rightIcon="fas fa-arrow-circle-right"
            />
        </MenuBar>
    )
};