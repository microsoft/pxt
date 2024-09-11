import { logError } from "../services/loggingService";
import { CriteriaParameter, CriteriaParameterType } from "./criteria";
import { ErrorCode } from "./errorCode";

export class BaseStringParameter extends CriteriaParameter {
    maxCharacters: number | undefined;

    constructor(name: string, type: CriteriaParameterType, paths: string[], defaultValue?: string, maxCharacters?: number) {
        super(name, type, paths, defaultValue);
        this.maxCharacters = maxCharacters;
    }

    override validate(value: any): boolean {
        return typeof value === "string" && (!this.maxCharacters || value.length <= this.maxCharacters);
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

    override validate(value: any): boolean {
        // Ensure the value is numeric and within the specified range.
        const num = Number(value);
        return !isNaN(num) && (!this.min || num >= this.min) && (!this.max || num <= this.max);
    }
}

export class BlockParameter extends CriteriaParameter {
    constructor(template: CriteriaParameter) {
        super(template.name, "block", template.paths, template.default);
    }
}

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
