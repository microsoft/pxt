import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { DebouncedInput } from "./DebouncedInput";
import { logDebug } from "../services/loggingService";
import { setParameterValue } from "../transforms/setParameterValue";
import { classList } from "react-common/components/util";
import { splitCriteriaTemplate } from "../utils";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/CriteriaInstanceDisplay.module.scss";
import { useState } from "react";

interface InlineInputSegmentProps {
    initialValue: string;
    instance: CriteriaInstance;
    param: CriteriaParameterValue;
    shouldExpand: boolean;
    numeric: boolean;
}
const InlineInputSegment: React.FC<InlineInputSegmentProps> = ({
    initialValue,
    instance,
    param,
    shouldExpand,
    numeric,
}) => {
    const [isEmpty, setIsEmpty] = useState(!initialValue);

    function onDebouncedChange(newValue: string) {
        setParameterValue(instance.instanceId, param.name, newValue);
    }

    function onChange(newValue: string) {
        // Keep this out of the debounced version to avoid delayed appearance.
        setIsEmpty(!newValue);
    }

    const tooltip = isEmpty ? lf("{0}: value required", param.name) : param.name;
    return (
        <div title={tooltip} className={css["inline-input-wrapper"]}>
            <DebouncedInput
                className={classList(
                    css["inline-input"],
                    numeric ? css["number-input"] : css["string-input"],
                    shouldExpand ? css["long"] : undefined,
                    isEmpty ? css["error"] : undefined
                )}
                icon={isEmpty ? "fas fa-exclamation-triangle" : undefined}
                initialValue={initialValue}
                onDebouncedChange={onDebouncedChange}
                onChange={onChange}
                preserveValueOnBlur={true}
                placeholder={numeric ? "0" : param.name}
                title={tooltip}
                autoComplete={false}
                type={numeric ? "number" : "text"}
            />
        </div>
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

    function getParameterSegmentDisplay(paramName: string): JSX.Element | null {
        if (!paramName) {
            return null;
        }

        const paramDef = catalogCriteria?.params?.find(p => p.name === paramName);
        const paramInstance = criteriaInstance?.params?.find(p => p.name === paramName);
        if (!paramDef || !paramInstance) {
            logDebug(`Missing info for '${paramName}': paramDef=${paramDef}, paramInstance=${paramInstance}`);
            return null;
        }

        if (paramDef.type === "block") {
            // TODO
            return null;
        } else {
            return (
                <InlineInputSegment
                    initialValue={paramInstance.value}
                    param={paramInstance}
                    instance={criteriaInstance}
                    shouldExpand={paramDef.type === "longString"}
                    numeric={paramDef.type === "number"}
                />
            );
        }
    }

    function getPlainTextSegmentDisplay(text: string): JSX.Element | null {
        return text ? <div className={css["text-segment"]}>{text}</div> : null;
    }

    const templateSegments = splitCriteriaTemplate(catalogCriteria.template);
    const display = templateSegments.map(s =>
        s.type === "plain-text" ? getPlainTextSegmentDisplay(s.content) : getParameterSegmentDisplay(s.content)
    );

    return catalogCriteria ? (
        <div className={css["criteria-instance-display"]}>
            <div className={css["segment-container"]}>
                {display.map((part, i) => (
                    <span className={css["segment"]} key={i}>
                        {part}
                    </span>
                ))}
            </div>
            <div className={css["criteria-description"]}>{catalogCriteria.description}</div>
        </div>
    ) : null;
};
