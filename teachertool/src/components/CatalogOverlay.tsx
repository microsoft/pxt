import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { addCriteriaToChecklist } from "../transforms/addCriteriaToChecklist";
import { CatalogCriteria } from "../types/criteria";
import { getCatalogCriteria } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { Strings } from "../constants";
import { Button } from "react-common/components/controls/Button";
import { Accordion } from "react-common/components/controls/Accordion";
import { getReadableCriteriaTemplate } from "../utils";
import { setCatalogOpen } from "../transforms/setCatalogOpen";
import { classList } from "react-common/components/util";
import { announceToScreenReader } from "../transforms/announceToScreenReader";
import { FocusTrap } from "react-common/components/controls/FocusTrap";
import { logError } from "../services/loggingService";
import { ErrorCode } from "../types/errorCode";
import { addExpandedCatalogTag, getExpandedCatalogTags, removeExpandedCatalogTag } from "../services/storageService";
import css from "./styling/CatalogOverlay.module.scss";

interface CatalogHeaderProps {
    onClose: () => void;
}
const CatalogHeader: React.FC<CatalogHeaderProps> = ({ onClose }) => {
    return (
        <div className={css["header"]}>
            <span className={css["title"]}>{Strings.SelectCriteriaDescription}</span>
            <Button
                className={css["close-button"]}
                rightIcon="fas fa-times-circle"
                onClick={onClose}
                title={Strings.Close}
            />
        </div>
    );
};

interface CatalogItemLabelProps {
    catalogCriteria: CatalogCriteria;
    isMaxed: boolean;
    recentlyAdded: boolean;
}
const CatalogItemLabel: React.FC<CatalogItemLabelProps> = ({ catalogCriteria, isMaxed, recentlyAdded }) => {
    const showRecentlyAddedIndicator = recentlyAdded && !isMaxed;
    return (
        <div className={css["catalog-item-label"]}>
            <div className={css["action-indicators"]}>
                {isMaxed ? (
                    <span>{Strings.Max}</span>
                ) : (
                    <>
                        <i
                            className={classList(
                                "fas fa-check",
                                css["recently-added-indicator"],
                                showRecentlyAddedIndicator ? undefined : css["hide-indicator"]
                            )}
                            title={lf("Added!")}
                        />
                        <i
                            className={classList(
                                "fas fa-plus",
                                showRecentlyAddedIndicator ? css["hide-indicator"] : undefined
                            )}
                            title={Strings.AddToChecklist}
                        />
                    </>
                )}
            </div>
            <ReadOnlyCriteriaDisplay catalogCriteria={catalogCriteria} showDescription={true} />
        </div>
    );
};

interface CatalogItemProps {
    catalogCriteria: CatalogCriteria;
    recentlyAddedIds: pxsim.Map<NodeJS.Timeout>;
    onItemClicked: (c: CatalogCriteria) => void;
}
const CatalogItem: React.FC<CatalogItemProps> = ({ catalogCriteria, recentlyAddedIds, onItemClicked }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const existingInstanceCount = teacherTool.checklist.criteria.filter(
        i => i.catalogCriteriaId === catalogCriteria.id
    ).length;
    const isMaxed = catalogCriteria.maxCount !== undefined && existingInstanceCount >= catalogCriteria.maxCount;
    return catalogCriteria.template ? (
        <Button
            title={getReadableCriteriaTemplate(catalogCriteria)}
            key={catalogCriteria.id}
            className={css["catalog-item"]}
            label={
                <CatalogItemLabel
                    catalogCriteria={catalogCriteria}
                    isMaxed={isMaxed}
                    recentlyAdded={recentlyAddedIds[catalogCriteria.id] !== undefined}
                />
            }
            onClick={() => onItemClicked(catalogCriteria)}
            disabled={isMaxed}
        />
    ) : null;
};

const CatalogList: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    const recentlyAddedWindowMs = 500;
    const [recentlyAddedIds, setRecentlyAddedIds] = useState<pxsim.Map<NodeJS.Timeout>>({});

    // For now, we only look at the first tag of each criteria.
    const criteriaGroupedByTag = useMemo<pxt.Map<CatalogCriteria[]>>(() => {
        const grouped: pxt.Map<CatalogCriteria[]> = {};
        getCatalogCriteria(teacherTool)?.forEach(c => {
            if (!c.tags || c.tags.length === 0) {
                logError(ErrorCode.missingTag, { message: "Catalog criteria missing tag", criteria: c });
                return;
            }

            const tag = c.tags[0];
            if (!grouped[tag]) {
                grouped[tag] = [];
            }
            grouped[tag].push(c);
        });
        return grouped;
    }, [teacherTool.catalog]);

    function updateRecentlyAddedValue(id: string, value: NodeJS.Timeout | undefined) {
        setRecentlyAddedIds(prevState => {
            const newState = { ...prevState };
            if (value) {
                newState[id] = value;
            } else {
                delete newState[id];
            }
            return newState;
        });
    }

    function onItemClicked(c: CatalogCriteria) {
        addCriteriaToChecklist([c.id]);

        // Set a timeout to remove the recently added indicator
        // and save it in the state.
        if (recentlyAddedIds[c.id]) {
            clearTimeout(recentlyAddedIds[c.id]);
        }
        const timeoutId = setTimeout(() => {
            updateRecentlyAddedValue(c.id, undefined);
        }, recentlyAddedWindowMs);
        updateRecentlyAddedValue(c.id, timeoutId);

        announceToScreenReader(lf("Added '{0}' to checklist.", getReadableCriteriaTemplate(c)));
    }

    function getItemIdForTag(tag: string) {
        return `accordion-item-${tag}`;
    }

    function onTagExpandToggled(tag: string, expanded: boolean) {
        if (expanded) {
            addExpandedCatalogTag(tag);
        } else {
            removeExpandedCatalogTag(tag);
        }
    }

    const tags = Object.keys(criteriaGroupedByTag);
    if (tags.length === 0) {
        logError(ErrorCode.noCatalogCriteria);
        return null;
    }

    let expandedTags = getExpandedCatalogTags();
    if (!expandedTags) {
        // If we haven't saved an expanded set, default expand the first one.
        addExpandedCatalogTag(tags[0]);
        expandedTags = [tags[0]];
    }

    const expandedIds = expandedTags.map(t => getItemIdForTag(t));
    return (
        <Accordion className={css["catalog-list"]} multiExpand={true} defaultExpandedIds={expandedIds}>
            {tags.map(tag => {
                return (
                    <Accordion.Item
                        itemId={getItemIdForTag(tag)}
                        onExpandToggled={expanded => onTagExpandToggled(tag, expanded)}
                        key={getItemIdForTag(tag)}
                    >
                        <Accordion.Header>{tag}</Accordion.Header>
                        <Accordion.Panel>
                            {criteriaGroupedByTag[tag].map(c => (
                                <CatalogItem
                                    catalogCriteria={c}
                                    recentlyAddedIds={recentlyAddedIds}
                                    onItemClicked={onItemClicked}
                                    key={`catalog-item-${c.id}`}
                                />
                            ))}
                        </Accordion.Panel>
                    </Accordion.Item>
                );
            })}
        </Accordion>
    );
};

interface CatalogOverlayProps {}
export const CatalogOverlay: React.FC<CatalogOverlayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function closeOverlay() {
        setCatalogOpen(false);
    }

    return teacherTool.catalogOpen ? (
        <FocusTrap onEscape={() => {}}>
            <div className={css["catalog-overlay"]}>
                <div className={css["catalog-content-container"]}>
                    <CatalogHeader onClose={closeOverlay} />
                    <CatalogList />
                </div>
            </div>
        </FocusTrap>
    ) : null;
};
