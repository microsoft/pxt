import * as React from "react";
import { useState, useContext, useEffect, useRef } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { CriteriaEvaluationResult } from "../types/criteria";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { Strings, Ticks } from "../constants";
import { DebouncedInput } from "./DebouncedInput";
import { setEvalResultNotes } from "../transforms/setEvalResultNotes";
import { CriteriaEvalResultDropdown } from "./CriteriaEvalResultDropdown";

interface AddNotesButtonProps {
    criteriaId: string;
    setShowInput: (show: boolean) => void;
}

const AddNotesButton: React.FC<AddNotesButtonProps> = ({ criteriaId, setShowInput }) => {
    const onAddNotesClicked = () => {
        pxt.tickEvent(Ticks.AddResultNotes, { criteriaId });
        setShowInput(true);
    };
    return (
        <div className={css["button-container"]}>
            <Button
                className={classList("inline", "add-button")}
                label={Strings.AddNotes}
                onClick={onAddNotesClicked}
                title={Strings.AddNotes}
                leftIcon="fas fa-plus-circle"
            />
        </div>
    );
}

interface CriteriaResultNotesProps {
    criteriaId: string;
    notes?: string;
}

const CriteriaResultNotes: React.FC<CriteriaResultNotesProps> = ({ criteriaId, notes }) => {
    // TODO: use a textarea instead of an input
    const onTextChange = (str: string) => {
        setEvalResultNotes(criteriaId, str);
    };

    return (
        <div className={css["notes-container"]}>
            <p>{lf("Notes")}</p>
            <DebouncedInput
                placeholder={lf("Write your notes here")}
                ariaLabel={lf("Notes regarding the criteria result")}
                preserveValueOnBlur={true}
                initialValue={notes ?? undefined}
                onChange={onTextChange}
                autoComplete={false}
                intervalMs={1000}
            />
        </div>
    )
}

interface CriteriaResultEntryProps {
    criteriaId: string;
    result: CriteriaEvaluationResult;
    label: string;
}

export const CriteriaResultEntry: React.FC<CriteriaResultEntryProps> = ({ criteriaId, result, label }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [showInput, setShowInput] = useState(false);
    const notesRef = useRef<string | undefined>(teacherTool.evalResults[criteriaId].notes);

    useEffect(() => {
        if (notesRef.current) {
            setShowInput(true);
        }
    }, [])
    return (
        <div className={css["specific-criteria-result"]} key={criteriaId}>
            <div className={css["result-details"]}>
                <h4 className={css["block-id-label"]}>
                    {label}
                </h4>
                <CriteriaEvalResultDropdown result={result} criteriaId={criteriaId} />
            </div>
            <div className={css["result-notes"]}>
                {!showInput && <AddNotesButton criteriaId={criteriaId} setShowInput={setShowInput} />}
                {showInput && <CriteriaResultNotes criteriaId={criteriaId} notes={notesRef.current}/>}
            </div>
        </div>
    );
}