import React, { CSSProperties, useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { LazyImage } from "react-common/components/controls/LazyImage";
import { loadBlockImagesAsync } from "../transforms/loadBlockImagesAsync";
import { FocusList } from "react-common/components/controls/FocusList";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { getReadableBlockString } from "../utils";
import { setParameterValue } from "../transforms/setParameterValue";
import { ErrorCode } from "../types/errorCode";
import { logError } from "../services/loggingService";
import { Strings } from "../constants";
import css from "./styling/BlockPickerModal.module.scss";

interface PickBlockButtonProps {
    block: pxt.editor.ToolboxBlockDefinition;
    category: pxt.editor.ToolboxCategoryDefinition;
    onBlockSelected: (blockId: pxt.editor.ToolboxBlockDefinition) => void;
}
const PickBlockButton: React.FC<PickBlockButtonProps> = ({ block, category, onBlockSelected }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    let imageUri = block.blockId ? teacherTool.blockImageCache[block.blockId] : undefined;

    const placeholderBlock = <div className={css["block-placeholder"]}>{getReadableBlockString(block.name)}</div>;

    return (
        <Button
            className={css["block-button"]}
            title={block.jsDoc ?? getReadableBlockString(block.name)}
            ariaLabel={block.name}
            label={
                imageUri ? (
                    <LazyImage src={imageUri} alt={block.name} loadingElement={placeholderBlock} ariaHidden={true} />
                ) : (
                    placeholderBlock
                )
            }
            onClick={() => onBlockSelected(block)}
        />
    );
};

interface BlockPickerCategoryProps {
    category: pxt.editor.ToolboxCategoryDefinition;
    onBlockSelected: (blockId: pxt.editor.ToolboxBlockDefinition) => void;
}
const BlockPickerCategory: React.FC<BlockPickerCategoryProps> = ({ category, onBlockSelected }) => {
    const [expanded, setExpanded] = useState(false);

    function blockSelected(block: pxt.editor.ToolboxBlockDefinition) {
        onBlockSelected?.(block);
    }

    function handleClick() {
        if (!expanded) {
            // We do not need to block on this.
            /* await */ loadBlockImagesAsync(category);
        }

        setExpanded(!expanded);
    }

    const categoryColorStyle = (category.color ? { "--category-color": category.color } : {}) as CSSProperties;
    const blockListId = `${category.name}-block-list`;
    return category.name && category.blocks && category.blocks.length > 0 ? (
        // Need bottom-border div to keep the bottom border from intersecting with the left border on category-container.
        <div className={css["bottom-border"]}>
            <div className={css["category-container"]} style={categoryColorStyle}>
                <Button
                    className={classList(css["category-button"], expanded ? css["bottom-border"] : undefined)}
                    title={category.name}
                    label={pxt.Util.capitalize(category.name)}
                    onClick={handleClick}
                    ariaExpanded={expanded}
                    ariaControls={blockListId}
                />
                <FocusList
                    id={blockListId}
                    role={"group"}
                    ariaLabel={lf("{0} Blocks", category.name)}
                    className={classList(css["category-block-list"], expanded ? css["expanded"] : css["collapsed"])}
                >
                    {category.blocks.map(block => (
                        <PickBlockButton key={block.blockId} block={block} category={category} onBlockSelected={blockSelected} />
                    ))}
                </FocusList>
            </div>
        </div>
    ) : null;
};

const LoadingBlocks: React.FC = () => {
    return (
        <div className={css["loading-container"]}>
            <div className="common-spinner" />
        </div>
    );
};

export interface BlockPickerModalProps {}
export const BlockPickerModal: React.FC<BlockPickerModalProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleBlockSelected(block: pxt.editor.ToolboxBlockDefinition) {
        if (teacherTool.blockPickerOptions) {
            setParameterValue(
                teacherTool.blockPickerOptions.criteriaInstanceId,
                teacherTool.blockPickerOptions.paramName,
                block.blockId
            );
        } else {
            logError(ErrorCode.selectedBlockWithoutOptions, "Block selected without block picker options.");
        }

        hideModal();
    }

    const modalActions = [
        {
            label: Strings.Cancel,
            className: "secondary",
            onClick: hideModal,
        },
    ];

    return teacherTool.modal === "block-picker" && teacherTool.blockPickerOptions ? (
        <Modal
            className={css["block-picker-modal"]}
            title={Strings.SelectBlock}
            onClose={hideModal}
            actions={modalActions}
        >
            {teacherTool.toolboxCategories &&
                Object.values(teacherTool.toolboxCategories).map(category => {
                    return (
                        <BlockPickerCategory
                            key={category.name}
                            category={category}
                            onBlockSelected={block => handleBlockSelected(block)}
                        />
                    );
                })}
            {!teacherTool.toolboxCategories && <LoadingBlocks />}
        </Modal>
    ) : null;
};
