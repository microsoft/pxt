/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useEffect, useState } from "react";
import { logDebug, logError } from "../services/loggingService";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { AppStateContext } from "../state/appStateContext";

interface IProps {}

interface CatalogInfo {
    criteria: pxt.blocks.CriteriaData[];
    testCriteria: pxt.blocks.CriteriaData[];
}

const CatalogDisplay: React.FC<IProps> = ({}) => {
    const [catalog, setCatalog] = useState<pxt.blocks.CriteriaData[] | undefined>(undefined);
    const [selectedCriteria, setSelectedCriteria] = useState<number[]>([]);

    // catalog.json is the target-specific catalog, catalog-shared is used by all targets.
    const prodFiles = ["/teachertool/catalog.json", "/teachertool/catalog-shared.json"];
    const testFiles = ["/teachertool/catalog-test.json", "/teachertool/catalog-shared-test.json"]

    // todo thsparks - does this belong in util?
    // Maybe parse catalog and add to state in a transform.
    // Then this class just kicks that off? Or it gets kicked off elsewhere somehow, like in app.tsx.
    async function getFullCatalog(): Promise<pxt.blocks.CriteriaData[] | undefined> {
        let fullCatalog: pxt.blocks.CriteriaData[] = [];

        const catalogFiles = pxt.options.debug ? prodFiles.concat(testFiles) : prodFiles;

        for (const catalogFile of catalogFiles) {
            let catalogContent = "";
            try {
                const catalogResponse = await fetch(catalogFile);
                catalogContent = await catalogResponse.text();
            } catch (e) {
                logError("fetch_catalog_failed", e as string, { catalogFile });
                continue;
            }

            if (!catalogContent) {
                // Empty file.
                continue;
            }

            try {
                const catalogInfoParsed = JSON.parse(catalogContent);
                const catalogInfo = catalogInfoParsed as CatalogInfo;
                fullCatalog = fullCatalog.concat(catalogInfo.criteria ?? []);
            } catch (e) {
                logError("parse_catalog_failed", e as string, {catalogFile});
                continue;
            }
        }
        return fullCatalog;
    }

    useEffect(() => {
        const prepCatalog = async () => {
            const catalog = await getFullCatalog();
            setCatalog(catalog);
        }

        prepCatalog();
    });

    function checkboxChanged (id: number, newValue: boolean) {
        if (newValue) {
            setSelectedCriteria([...selectedCriteria, id]);
        } else if (selectedCriteria.indexOf(id) !== -1) {
            setSelectedCriteria(selectedCriteria.filter((item) => item !== id));
        }

        logDebug(`${newValue ? "Checked" : "Unchecked"} checkbox ${id} = ${catalog![id].displayText}}`);
    }

    function isCheckboxChecked (id: number) {
        return selectedCriteria.indexOf(id) !== -1;
    }

    return (
        <div className="catalog-container">
            {
                catalog?.map((criteria, index) => {
                    return (
                        <div className="catalog-item">
                            <Checkbox id={`chk${index}`} label={criteria.displayText} isChecked={isCheckboxChecked(index)} onChange={(newVal) => checkboxChanged(index, newVal)} />
                        </div>
                    )
                })
            }
        </div>
    )

};

export default CatalogDisplay;
