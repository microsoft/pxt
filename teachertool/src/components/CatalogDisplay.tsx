/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";
import { addCriteriaToRubric } from "../transforms/addCriteriaToRubric";

interface IProps {}

const CatalogDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <>
            {teacherTool.catalog?.map(criteria => {
                return criteria?.template && (
                        <Button
                            id={`btn${criteria.id}`}
                            className="catalog-item"
                            label={criteria.template}
                            onClick={() => addCriteriaToRubric(criteria)}
                            title={criteria.id} />
                );
            })}
        </>
    );
};

export default CatalogDisplay;
