import { getCatalogCriteriaWithId } from "../state/helpers";
import { Checklist } from "../types/checklist";
import css from "./styling/ChecklistPreview.module.scss";

export interface IChecklistPreviewProps {
    checklist: Checklist;
}

export const ChecklistPreview: React.FC<IChecklistPreviewProps> = ({ checklist }) => {
    return (
        <div className={css["container"]}>
            <div className={css["checklist-header"]}>{checklist.name}</div>
            {checklist.criteria.map((c, i) => {
                const template = getCatalogCriteriaWithId(c.catalogCriteriaId)?.template;
                return template ? (
                    <div key={i} className={css["checklist-criteria"]}>
                        {template}
                    </div>
                ) : null;
            })}
        </div>
    );
};
