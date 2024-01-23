/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";
import { Modal } from "react-common/components/controls/Modal";
import CatalogDisplay from "./CatalogDisplay";
import * as Actions from "../state/actions";

interface IProps {}

const CatalogModal: React.FC<IProps> = ({}) => {
    const { state: teacherTool, dispatch } = useContext(AppStateContext);

    function handleDoneClicked() {
        dispatch(Actions.hideModal());
    }

    return teacherTool.modal ? (
        <Modal className="catalog-modal" title={lf("Select the criteria you'd like to include")} onClose={handleDoneClicked}>
            <div className="catalog-container" title={lf("Select the criteria you'd like to include")}>
                <CatalogDisplay />
                <Button className="catalog-done primary" label={lf("Done")} onClick={handleDoneClicked} title={lf("Done")} />
            </div>
        </Modal>
    ) : null;
};

export default CatalogModal;
