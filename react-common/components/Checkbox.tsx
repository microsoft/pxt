import * as React from "react";

export enum CheckboxStatus {
    Selected,
    Unselected,
    Waiting
}

export interface CheckboxProps {
    isChecked: CheckboxStatus;
    onClick: (checked: boolean) => void;
}

export const Checkbox = (props: CheckboxProps) => {
    const { isChecked } = props;
    return (
        <div className="checkbox">
            {isChecked == CheckboxStatus.Waiting ? <div className={`ui inline mini loader active`}/> :
            <i className={`icon square outline ${isChecked == CheckboxStatus.Selected ? "check":""}`} onClick={() => props.onClick(!(isChecked == CheckboxStatus.Selected))}/>}
        </div>
    );
}

