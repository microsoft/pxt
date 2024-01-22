/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useEffect, useState } from "react";
import { logDebug, logError } from "../services/loggingService";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";

interface IProps {}

const CatalogDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleClick (criteria: pxt.blocks.CatalogCriteria) {
        // Todo call into addCriteriaInstance
        logDebug(`Add criteria with id: ${criteria.id}`);

        // Template prop is technically redundant but added for easy readability when querying
        pxt.tickEvent("teachertool.addcriteria", { id: criteria.id, template: criteria.template });
    }

    return (
        <div className="catalog-container">
            {
                teacherTool.catalog?.map(criteria => {
                    return criteria?.template && <Button id={`btn${criteria.id}`} className="catalog-item" label={criteria.template} onClick={() => handleClick(criteria)} title={criteria.id} />
                })
            }
        </div>
    )

};

export default CatalogDisplay;
