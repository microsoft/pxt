import { getCatalogCriteriaWithId } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { CriteriaInstance, CriteriaParameter, CriteriaParameterValue } from "../types/criteria";
import { DebouncedInput } from "./DebouncedInput";
import { logDebug } from "../services/loggingService";
import { setParameterValue } from "../transforms/setParameterValue";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/CriteriaInstanceDisplay.module.scss";

interface StringInputSnippetProps {
    initialValue: string;
    instance: CriteriaInstance;
    param: CriteriaParameterValue;
}
const StringInputSnippet: React.FC<StringInputSnippetProps> = ({ initialValue, instance, param }) => {
    function onChange(newValue: string) {
        setParameterValue(instance.instanceId, param.name, newValue);
    }

    return (
        <DebouncedInput
            className={css["string-input"]}
            initialValue={initialValue}
            onChange={onChange}
            preserveValueOnBlur={true}
            placeholder={lf(param.name)}
        />
    );
};

interface CriteriaInstanceDisplayProps {
    criteriaInstance: CriteriaInstance;
}

export const CriteriaInstanceDisplay: React.FC<CriteriaInstanceDisplayProps> = ({ criteriaInstance }) => {
    const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
    if (!catalogCriteria) {
        return null;
    }

    function getParameterSnippetDisplay(paramName: string): JSX.Element | null {
        logDebug(`Looking up snippet for parameter '${paramName}'`);
        const paramDef = catalogCriteria?.params?.find(p => p.name === paramName);
        const paramInstance = criteriaInstance?.params?.find(p => p.name === paramName);
        if (!paramDef || !paramInstance) {
            logDebug(`Missing info for '${paramName}': paramDef=${paramDef}, paramInstance=${paramInstance}`);
            return null;
        }

        switch (paramDef.type) {
            case "string":
                logDebug(
                    `Creating string input for parameter '${paramName}' with initial value '${paramInstance.value}'`
                );
                return (
                    <StringInputSnippet
                        initialValue={paramInstance.value}
                        param={paramInstance}
                        instance={criteriaInstance}
                    />
                );
            case "number":
            // TODO
            case "block":
            // TODO
            default:
                return null;
        }
    }

    const paramRegex = /\$\{(\w+)\}/g;

    // Split by the regex, which will give us an array where every other element is a parameter.
    const parts = catalogCriteria.template.split(paramRegex);
    const display: JSX.Element[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) {
            continue;
        }

        if (i % 2 === 0) {
            // Plain text
            display.push(<div className={css["text-snippet"]}>{part}</div>);
        } else {
            // Parameter
            const snippet = getParameterSnippetDisplay(part);
            if (snippet) {
                display.push(snippet);
            }
        }
    }

    return catalogCriteria ? (
        <div className={css["criteria-instance-display"]}>
            <div className={css["snippet-container"]}>
                {display.map((part, i) => (
                    {...part, key: i}
                ))}
            </div>
            <Button
                className={css["criteria-btn-remove"]}
                label={lf("X")}
                onClick={() => removeCriteriaFromRubric(criteriaInstance)}
                title={lf("Remove")}
            />
        </div>
    ) : null;
};
