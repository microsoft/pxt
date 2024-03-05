import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { DebouncedInput } from "./DebouncedInput";
import { logDebug } from "../services/loggingService";
import { setParameterValue } from "../transforms/setParameterValue";
import { classList } from "react-common/components/util";
import { useState } from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/CriteriaInstanceDisplay.module.scss";


interface InlineInputSnippetProps {
    initialValue: string;
    instance: CriteriaInstance;
    param: CriteriaParameterValue;
    shouldExpand: boolean;
    numeric: boolean;
}
const InlineInputSnippet: React.FC<InlineInputSnippetProps> = ({
    initialValue,
    instance,
    param,
    shouldExpand,
    numeric,
}) => {
    const [error, setError] = useState("");

    function onChange(newValue: string) {
        if (!numeric || !isNaN(Number(newValue))) {
            setError("");
            setParameterValue(instance.instanceId, param.name, newValue);
        } else {
            setError(lf("value must be numeric"));
        }
    }

    return (
        <DebouncedInput
            className={classList(
                css["inline-input"],
                numeric ? css["number-input"] : css["string-input"],
                shouldExpand ? css["long"] : undefined,
                error ? css["error"] : undefined
            )}
            initialValue={initialValue}
            onChange={onChange}
            preserveValueOnBlur={true}
            placeholder={numeric ? "0" : lf(param.name)}
            title={error ? lf("{0} - {1}", param.name, error) : param.name}
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
                return (
                    <InlineInputSnippet
                        initialValue={paramInstance.value}
                        param={paramInstance}
                        instance={criteriaInstance}
                        shouldExpand={paramDef.picker === "longString"}
                        numeric={false}
                    />
                );
            case "number":
                return (
                    <InlineInputSnippet
                        initialValue={paramInstance.value || 1}
                        param={paramInstance}
                        instance={criteriaInstance}
                        shouldExpand={paramDef.picker === "longString"}
                        numeric={true}
                    />
                );
            case "block":
            // TODO
            default:
                return null;
        }
    }

    const paramRegex = /\$\{([\w\s]+)\}/g;

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
            <div className={css["snippet-container"]}>{display.map((part, i) => ({ ...part, key: i }))}</div>
            <div className={css["criteria-description"]}>{catalogCriteria.description}</div>
        </div>
    ) : null;
};
