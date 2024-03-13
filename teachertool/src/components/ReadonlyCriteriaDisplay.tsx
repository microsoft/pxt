import { useContext, useMemo } from "react";
import { CatalogCriteria, CriteriaInstance } from "../types/criteria";
import { splitCriteriaTemplate } from "../utils";
import { CriteriaTemplateSegment } from "../types";
import { getParameterValue } from "../state/helpers";
import { AppStateContext } from "../state/appStateContext";
import css from "./styling/ReadonlyCriteriaDisplay.module.scss";

export interface ReadOnlyCriteriaDisplayProps {
    catalogCriteria: CatalogCriteria;
    criteriaInstance?: CriteriaInstance; // If defined, show parameter values in the display. Else, show parameter names.
    showDescription?: boolean;
}

export const ReadOnlyCriteriaDisplay: React.FC<ReadOnlyCriteriaDisplayProps> = ({
    catalogCriteria,
    criteriaInstance,
    showDescription,
}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function getSegmentDisplayText(segment: CriteriaTemplateSegment): string {
        if (!criteriaInstance || segment.type === "plain-text") {
            return segment.content;
        }

        return getParameterValue(teacherTool, criteriaInstance.instanceId, segment.content) ?? "";
    }

    const segments = useMemo(() => splitCriteriaTemplate(catalogCriteria.template), [catalogCriteria.template]);
    return (
        <div className={css["criteria-display"]}>
            {catalogCriteria.template && (
                <div className={css["criteria-template"]}>
                    {segments.map((segment, index) => {
                        return (
                            <span key={index} className={css[`${segment.type}-segment`]}>
                                {getSegmentDisplayText(segment)}
                            </span>
                        );
                    })}
                </div>
            )}
            {showDescription && catalogCriteria.description && (
                <div className={css["criteria-description"]}>{catalogCriteria.description}</div>
            )}
        </div>
    );
};
