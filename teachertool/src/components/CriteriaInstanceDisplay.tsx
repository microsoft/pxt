import css from "./styling/CriteriaInstanceDisplay.module.scss";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaInstance, CriteriaParameterValue } from "../types/criteria";
import { logDebug } from "../services/loggingService";
import { setParameterValue } from "../transforms/setParameterValue";
import { classList } from "react-common/components/util";
import { getReadableBlockString, splitCriteriaTemplate } from "../utils";
import { useContext, useMemo, useState } from "react";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/appStateContext";
import { Strings } from "../constants";
import { showModal } from "../transforms/showModal";
import { BlockPickerOptions } from "../types/modalOptions";

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

    function onChange(newValue: string) {
        setIsEmpty(!newValue);
        setParameterValue(instance.instanceId, param.name, newValue);
    }

    const tooltip = isEmpty ? `"${param.name}: ${Strings.ValueRequired}` : param.name;
    return (
        <div title={tooltip} className={css["inline-input-wrapper"]}>
            <Input
                className={classList(
                    css["inline-input"],
                    numeric ? css["number-input"] : css["string-input"],
                    shouldExpand ? css["long"] : undefined,
                    isEmpty ? css["error"] : undefined
                )}
                icon={isEmpty ? "fas fa-exclamation-triangle" : undefined}
                initialValue={initialValue}
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
    return (
        <Button
            label={blockData ? getReadableBlockString(blockData.block.name) : param.value || param.name}
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
