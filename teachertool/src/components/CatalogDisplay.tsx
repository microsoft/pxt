/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useEffect, useState } from "react";
import { logDebug, logError } from "../services/loggingService";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";

interface IProps {}

const CatalogDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleClick (id: string) {
        // Todo call into addCriteriaInstance
        logDebug(`Add criteria with id: ${id}`);

        pxt.tickEvent("teachertool.addcriteria", { id: id });
    }

    return (
        <>
            {teacherTool.catalog?.map(criteria => {
                return criteria?.template && (
                        <Button
                            id={`btn${criteria.id}`}
                            className="catalog-item"
                            label={criteria.template}
                            onClick={() => handleClick(criteria.id)}
                            title={criteria.id} />
                );
            })}
        </>
    );
};

export default CatalogDisplay;
