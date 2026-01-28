import css from "./styling/CriteriaInstanceDisplay.module.scss";
import { getCatalogCriteriaWithId, getParameterDefinition } from "../state/helpers";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { logDebug } from "../services/loggingService";
import { setParameterValue } from "../transforms/setParameterValue";
import { classList } from "react-common/components/util";
import { splitCriteriaTemplate } from "../utils";
import { useContext, useEffect, useMemo, useState } from "react";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/appStateContext";
import { Strings, Ticks } from "../constants";
import { showModal } from "../transforms/showModal";
import { BlockPickerOptions } from "../types/modalOptions";
import { validateParameterValue } from "../utils/validateParameterValue";
import { loadBlockAsText } from "../transforms/loadReadableBlockName";

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
    const [errorMessage, setErrorMessage] = useState(initialValue ? "" : Strings.ValueRequired);
    const paramDefinition = useMemo(() => getParameterDefinition(instance.catalogCriteriaId, param.name), [param]);
    const paramOptions = useMemo(() => {
        if (!paramDefinition?.options?.length) {
            return undefined;
        }

        return paramDefinition.options.reduce((acc, option) => {
            const optionLabel = option.label || option.value;
            const optionValue = option.value ?? optionLabel;

            if (optionLabel && optionValue) {
                acc[optionLabel] = optionValue;
            }

            return acc;
        }, {} as pxt.Map<string>);
    }, [paramDefinition]);

    useEffect(() => {
        if (!paramDefinition) {
            return;
        }

        if (!initialValue) {
            setErrorMessage(Strings.ValueRequired);
            return;
        }

        // We still allow some invalid values to be set on the parameter so the user can see what they typed
        // and the associated error.
        // Without this, we risk erroring too soon (i.e. typing in first digit of number with min > 10),
        // losing the user's input (which could be long), or desynchronizing the UI from the state.
        // It will still be blocked via a separate check when the user tries to evaluate the criteria.
        const paramValidation = validateParameterValue(paramDefinition, initialValue);
        if (!paramValidation.valid) {
            setErrorMessage(paramValidation.message ?? Strings.InvalidValue);
        } else {
            setErrorMessage("");
        }
    }, [initialValue]);

    function onChange(newValue: string) {
        if (!newValue) {
            setErrorMessage(Strings.ValueRequired);
        }

        setParameterValue(instance.instanceId, param.name, newValue);
    }

    const tooltip = errorMessage ? `${param.name}: ${errorMessage}` : param.name;
    return (
        <div title={tooltip} className={css["inline-input-wrapper"]}>
            <Input
                className={classList(
                    css["inline-input"],
                    numeric ? css["number-input"] : css["string-input"],
                    shouldExpand ? css["long"] : undefined,
                    errorMessage ? css["error"] : undefined
                )}
                options={paramOptions}
                icon={errorMessage ? "fas fa-exclamation-triangle" : undefined}
                initialValue={initialValue}
                onChange={onChange}
                onOptionSelected={onChange}
                preserveValueOnBlur={true}
                placeholder={numeric ? "0" : param.name}
                title={tooltip}
                filter={numeric && !paramOptions ? "[0-9]{1,2}" : undefined}
            />
        </div>
    );
};

interface ReadableBlockNameProps {
    blockId: string;
}
const ReadableBlockName: React.FC<ReadableBlockNameProps> = ({ blockId }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [blockAsText, setBlockAsText] = useState<pxt.editor.BlockAsText | undefined>(undefined);

    useEffect(() => {
        async function updateReadableName(blockId: string | undefined) {
            let blockReadableName: pxt.editor.BlockAsText | undefined;
            if (blockId) {
                blockReadableName = blockId ? await loadBlockAsText(blockId) : undefined;
            }

            if (blockReadableName) {
                setBlockAsText(blockReadableName);
            } else if (!teacherTool.toolboxCategories) {
                // If teacherTool.toolboxCategories has not loaded yet, we may get the readable component later once it loads.
                // Show a spinner (handled below).
                setBlockAsText(undefined);
            } else {
                // TeacherTool.toolboxCategories has loaded and we still don't have a readable component.
                // We won't be able to get it, so fallback to the id.
                setBlockAsText({ parts: [{ kind: "label", content: blockId }] });
            }
        }

        updateReadableName(blockId);
    }, [blockId, teacherTool.toolboxCategories]);

    const readableComponent = blockAsText?.parts.map((part, i) => {
        let content = "";
        if (part.kind === "param") {
            // Mask default values like "hello!" with generic "value"
            // This is done to reduce confusion about what is actually being checked.
            content = lf("value");
        } else if (part.kind === "label" && part.content) {
            content = part.content;
        }

        return (
            <span
                key={`block-name-part-${i}`}
                className={classList(
                    css["block-name-segment"],
                    part.kind === "param" ? css["block-name-param"] : css["block-name-label"]
                )}
            >
                {content}
            </span>
        );
    });

    return (
        <span className={css["block-readable-name"]}>{readableComponent || <div className="common-spinner" />}</span>
    );
};

interface BlockInputSegmentProps {
    instance: CriteriaInstance;
    param: CriteriaParameterValue;
}
interface BlockData {
    category: pxt.editor.ToolboxCategoryDefinition;
    block: pxt.editor.ToolboxBlockDefinition;
}
const BlockInputSegment: React.FC<BlockInputSegmentProps> = ({ instance, param }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleClick() {
        pxt.tickEvent(Ticks.BlockPickerOpened, { criteriaCatalogId: instance.catalogCriteriaId });
        showModal({
            modal: "block-picker",
            criteriaInstanceId: instance.instanceId,
            paramName: param.name,
        } as BlockPickerOptions);
    }

    const blockData = useMemo<BlockData | undefined>(() => {
        if (!param.value || !teacherTool.toolboxCategories) {
            return undefined;
        }

        // Scan all categories and find the block with the matching id
        for (const category of Object.values(teacherTool.toolboxCategories)) {
            const block = category.blocks?.find(b => b.blockId === param.value);
            if (block) {
                return { category, block };
            }
        }
        return undefined;
    }, [param.value, teacherTool.toolboxCategories]);

    const style = blockData ? { backgroundColor: blockData.category.color, color: "white" } : undefined;
    const blockDisplay = param.value ? <ReadableBlockName blockId={param.value} /> : param.name;
    return (
        <Button
            label={blockDisplay}
            className={classList(css["block-input-btn"], param.value ? undefined : css["error"])}
            onClick={handleClick}
            title={param.value ? Strings.SelectBlock : `${Strings.SelectBlock}: ${Strings.ValueRequired}`}
            leftIcon={param.value ? undefined : "fas fa-exclamation-triangle"}
            style={style}
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
            return <BlockInputSegment param={paramInstance} instance={criteriaInstance} />;
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
            <div className={classList(css["criteria-description"], "no-print")}>{catalogCriteria.description}</div>
            <div className={classList(css["criteria-description"], css["for-print"], "only-print")}>
                {catalogCriteria.description}
            </div>
        </div>
    ) : null;
};
