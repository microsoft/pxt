import { stateAndDispatch } from "../state";
import { Rubric } from "../types/rubric";
import * as Actions from "../state/actions";
import { validateCriteriaInstance } from "../state/helpers";
import { logError } from "../services/loggingService";
import { ErrorCode } from "../types/errorCode";

export function setRubric(rubric: Rubric, validateRubric: boolean, continueOnCriteriaFailure: boolean): boolean {
    const { dispatch } = stateAndDispatch();

    let rubricToSet = rubric;
    let criteriaFailures = false;
    if (validateRubric) {
        const criteriaInstances = [];
        for (const criteria of rubric.criteria) {
            try {
                validateCriteriaInstance(criteria);
                criteriaInstances.push(criteria);
            } catch (error) {
                logError(ErrorCode.unableToLoadCriteriaInstance, error);
                criteriaFailures = true;
                if (!continueOnCriteriaFailure) {
                    return false;
                }
            }
        }

        // Do not change the object that was passed in.
        rubricToSet = { ...rubric, criteria: criteriaInstances };
    }

    dispatch(Actions.setRubric(rubricToSet));
    return !criteriaFailures;
}