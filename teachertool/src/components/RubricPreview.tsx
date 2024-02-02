import { getCatalogCriteriaWithId } from "../state/helpers";
import { Rubric } from "../types/rubric";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/RubricPreview.module.scss";

export interface IRubricPreviewProps {
    rubric: Rubric;
}

export const RubricPreview: React.FC<IRubricPreviewProps> = ({ rubric }) => {
    return (
        <div className={css["rubric-preview-container"]}>
            <div className={css["rubric-header"]}>{rubric.name}</div>
            {rubric.criteria.map((c, i) => {
                const template = getCatalogCriteriaWithId(c.catalogCriteriaId)?.template;
                return template ? (
                    <div key={i} className={css["rubric-criteria"]}>
                        {template}
                    </div>
                ) : null;
            })}
        </div>
    );
};
