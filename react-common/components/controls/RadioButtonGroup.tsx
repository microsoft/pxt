import * as React from "react";
import { classList, ControlProps } from "../util";
import { FocusList } from "./FocusList";

export interface RadioButtonGroupProps extends ControlProps {
    id: string;
    choices: RadioGroupChoice[];
    selectedId: string;
    onChoiceSelected: (id: string) => void;
}

export interface RadioGroupChoice {
    title: string;
    id: string;
    className?: string;
    icon?: string;
    label?: string | JSX.Element;
}

export const RadioButtonGroup = (props: RadioButtonGroupProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role,
        choices,
        selectedId,
        onChoiceSelected
    } = props;

    const onChoiceClick = (id: string) => {
        onChoiceSelected(id);
    }

    return (
        <FocusList id={id}
            className={classList("common-radio-group", className)}
            ariaHidden={ariaHidden}
            ariaLabel={ariaLabel}
            role={role || "radiogroup"}
            childTabStopId={selectedId}>
            {choices.map(choice =>
                <div key={choice.id}
                    className={classList("common-radio-choice", choice.className, selectedId === choice.id && "selected" )}>
                    <input
                        type="radio"
                        id={choice.id}
                        value={choice.id}
                        name={id + "-input"}
                        checked={selectedId === choice.id}
                        onChange={() => onChoiceClick(choice.id)}
                        tabIndex={0}
                        aria-label={choice.label ? undefined : choice.title}
                        aria-labelledby={choice.label ? choice.id + "-label" : undefined} />
                    {choice.label &&
                        <span id={choice.id + "-label"}>
                            {choice.label}
                        </span>
                    }
                    {choice.icon && <i className={choice.icon} aria-hidden={true}/>}
                </div>
            )}
        </FocusList>
    )
}