import { Strings } from "../constants";
import {
    CriteriaParameter,
    CriteriaParameterValidationResult,
    LongStringParameter,
    NumberParameter,
    StringParameter,
    StringParameterBase,
} from "../types/criteriaParameters";

export function validateParameterValue(param: CriteriaParameter, value: string): CriteriaParameterValidationResult {
    switch (param.type) {
        case "string":
            return validateStringParameter(param, value);
        case "longString":
            return validateLongStringParameter(param, value);
        case "number":
            return validateNumberParameter(param, value);
        case "block":
        // Fall through to default case.
        case "system":
        // Fall through to default case.
        default:
            return { valid: true } as CriteriaParameterValidationResult;
    }
}

function validateStringParameterBase(param: StringParameterBase, value: string): CriteriaParameterValidationResult {
    if (!value) return { valid: true }; // Unset is okay for initial value

    if (param.maxCharacters && value.length > param.maxCharacters) {
        return { valid: false, message: Strings.ExceedsMaxLength };
    }
    return { valid: true };
}

function validateStringParameter(param: StringParameter, value: string): CriteriaParameterValidationResult {
    return validateStringParameterBase(param, value);
}

function validateLongStringParameter(param: LongStringParameter, value: string): CriteriaParameterValidationResult {
    return validateStringParameterBase(param, value);
}

function validateNumberParameter(param: NumberParameter, value: string): CriteriaParameterValidationResult {
    // Ensure the value is numeric and within the specified range.
    const num = Number(value);
    if (isNaN(num)) {
        return {
            valid: false,
            message: Strings.MustBeANumber,
        };
    }
    if (param.min !== undefined && num < param.min) {
        return {
            valid: false,
            message: Strings.BelowMin,
        };
    }
    if (param.max !== undefined && num > param.max) {
        return {
            valid: false,
            message: Strings.ExceedsMax,
        };
    }
    return { valid: true };
}
