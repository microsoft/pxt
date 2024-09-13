import { Strings } from "../constants";
import { logError } from "../services/loggingService";
import { ErrorCode } from "./errorCode";

export type CriteriaParameterType = "string" | "longString" | "number" | "block" | "system";

export interface CriteriaParameterValidationResult {
    valid: boolean;
    message?: string;
}

// Represents a parameter definition in a catalog criteria.
export class CriteriaParameter {
    name: string;
    type: CriteriaParameterType;
    default: string | undefined;
    paths: string[]; // The json path(s) to update with the parameter value in the catalog criteria.

    constructor(name: string, type: CriteriaParameterType, paths: string[], defaultValue?: string) {
        this.name = name;
        this.type = type;
        this.default = defaultValue;
        this.paths = paths;
    }

    validate(value: string): CriteriaParameterValidationResult {
        return { valid: true };
    }
}

export class BaseStringParameter extends CriteriaParameter {
    maxCharacters: number | undefined;

    constructor(
        name: string,
        type: CriteriaParameterType,
        paths: string[],
        defaultValue?: string,
        maxCharacters?: number
    ) {
        super(name, type, paths, defaultValue);
        this.maxCharacters = maxCharacters;
    }

    override validate(value: string): CriteriaParameterValidationResult {
        if (!value) return { valid: true }; // Unset is okay for initial value

        if (this.maxCharacters && value.length > this.maxCharacters) {
            return { valid: false, message: Strings.ExceedsMaxLength };
        }
        return { valid: true };
    }
}

export class StringParameter extends BaseStringParameter {
    constructor(template: CriteriaParameter, maxCharacters?: number) {
        super(template.name, "string", template.paths, template.default, maxCharacters);
    }
}

export class LongStringParameter extends BaseStringParameter {
    constructor(template: CriteriaParameter, maxCharacters?: number) {
        super(template.name, "longString", template.paths, template.default, maxCharacters);
    }
}

export class NumberParameter extends CriteriaParameter {
    min: number | undefined;
    max: number | undefined;

    constructor(template: CriteriaParameter, min?: number, max?: number) {
        super(template.name, "number", template.paths, template.default);
        this.min = min;
        this.max = max;
    }

    override validate(value: any): CriteriaParameterValidationResult {
        // Ensure the value is numeric and within the specified range.
        const num = Number(value);
        if (isNaN(num)) {
            return {
                valid: false,
                message: Strings.MustBeANumber,
            };
        }
        if (this.min !== undefined && num < this.min) {
            return {
                valid: false,
                message: Strings.BelowMin,
            };
        }
        if (this.max !== undefined && num > this.max) {
            return {
                valid: false,
                message: Strings.ExceedsMax,
            };
        }
        return { valid: true };
    }
}

export class BlockParameter extends CriteriaParameter {
    constructor(template: CriteriaParameter) {
        super(template.name, "block", template.paths, template.default);
    }
}

// System parameters are fields that can change for a criteria but which are not set directly by the user.
// For example, the project id could be a parameter, but we fill it automatically at eval-time based on the loaded project.
export class SystemParameter extends CriteriaParameter {
    key?: string;

    constructor(template: CriteriaParameter, key?: string) {
        super(template.name, "system", template.paths, template.default);
        this.key = key;
    }
}

export function createSpecificParameter(param: CriteriaParameter, catalogCriteriaId: string): CriteriaParameter {
    switch (param.type) {
        case "string":
            return new StringParameter(param, (param as StringParameter)?.maxCharacters);
        case "longString":
            return new LongStringParameter(param, (param as LongStringParameter)?.maxCharacters);
        case "number":
            const tempCast = param as NumberParameter;
            return new NumberParameter(param, tempCast?.min, tempCast?.max);
        case "block":
            return new BlockParameter(param);
        case "system":
            return new SystemParameter(param, (param as SystemParameter)?.key);
        default:
            // Log the error but don't throw. Base param may still be sufficient for operation.
            logError(ErrorCode.unrecognizedParameterType, `Unrecognized parameter type: ${param.type}`, {
                catalogCriteriaId: catalogCriteriaId,
                paramName: param.name,
                paramType: param.type,
            });
            return param;
    }
}
