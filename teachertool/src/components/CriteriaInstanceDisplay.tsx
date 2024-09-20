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
import { Strings } from "../constants";
import { showModal } from "../transforms/showModal";
import { BlockPickerOptions } from "../types/modalOptions";
import { validateParameterValue } from "../utils/validateParameterValue";
import { getReadableBlockName } from "../services/makecodeEditorService";

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

    useEffect(() => {
        if (!paramDefinition) {
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
                icon={errorMessage ? "fas fa-exclamation-triangle" : undefined}
                initialValue={initialValue}
                onChange={onChange}
                preserveValueOnBlur={true}
                placeholder={numeric ? "0" : param.name}
                title={tooltip}
                autoComplete={false}
                filter={numeric ? "[0-9]{1,2}" : undefined}
            />
        </div>
    );
};

interface ReadableBlockNameDisplayProps {
    blockData: BlockData;
}
const ReadableBlockNameDisplay: React.FC<ReadableBlockNameDisplayProps> = ({ blockData }) => {
    const [readableName, setReadableName] = useState<pxt.editor.ReadableBlockName | undefined>(undefined);

    useEffect(() => {
        async function updateReadableName(blockId: string | undefined) {
            let blockReadableName: pxt.editor.ReadableBlockName | undefined;
            if (blockId) {
                blockReadableName = blockId ? await getReadableBlockName(blockId) : undefined;
            }

            if (blockReadableName) {
                setReadableName(blockReadableName);
            } else {
                // We were unable to get block name from the editor. Fallback to snippet name and/or name.
                setReadableName({
                    parts: [{ kind: "label", content: blockData.block.snippetName || blockData.block.name }],
                } as pxt.editor.ReadableBlockName);
            }
        }

        updateReadableName(blockData.block.blockId);
    }, [blockData]);

    const readableComponent = readableName?.parts.map((part, i) => {
        return (
            <span
                key={`block-name-part-${i}`}
                className={classList(
                    css["block-name-segment"],
                    part.kind === "param" ? css["block-name-param"] : css["block-name-label"]
                )}
            >
                {part.kind == "break" ? "" : part.content}
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

    function handleClick() {
        showModal({
            modal: "block-picker",
            criteriaInstanceId: instance.instanceId,
            paramName: param.name,
        } as BlockPickerOptions);
    }

    const style = blockData ? { backgroundColor: blockData.category.color, color: "white" } : undefined;
    const blockDisplay = blockData ? <ReadableBlockNameDisplay blockData={blockData} /> : null;
    return (
        <Button
            label={blockDisplay || param.value || param.name}
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
