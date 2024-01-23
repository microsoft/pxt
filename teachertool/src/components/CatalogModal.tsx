/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";
import { Modal } from "react-common/components/controls/Modal";
import CatalogDisplay from "./CatalogDisplay";
import { hideCatalog } from "../transforms/hideCatalog";

interface IProps {}

const CatalogModal: React.FC<IProps> = ({}) => {
    const { state: teacherTool, dispatch } = useContext(AppStateContext);

    return teacherTool.modal ? (
        <Modal className="catalog-modal" title={lf("Select the criteria you'd like to include")} onClose={hideCatalog}>
            <div className="catalog-container" title={lf("Select the criteria you'd like to include")}>
                <CatalogDisplay />
                <Button className="catalog-done primary" label={lf("Done")} onClick={hideCatalog} title={lf("Done")} />
            </div>
        </Modal>
    ) : null;
};

export default CatalogModal;
