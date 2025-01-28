/// <reference path="../types.d.ts" />

import { Modal, ModalAction } from "../controls/Modal";

/**
 * A modal that displays a message when the specified experience is not supported
 * by the current target. Contains a button to return to the home page and no dismiss.
 */
export const UnsupportedExperienceModal = () => {
    function fireGoBackTick() {
        pxt.tickEvent("unsupportedexperience.goback");
    }

    const homeUrl = pxt.U.getHomeUrl();

    const goBackAction: ModalAction = {
        label: lf("Go Back"),
        onClick: fireGoBackTick,
        className: "primary",
        url: homeUrl
    }

    return (
        <Modal title={lf("Unsupported Experience")} hideDismissButton={true} actions={[goBackAction]}>
            <div className="ui unsupported-modal-content">
                <p>{lf("The current experience is not supported in {0}.", pxt.appTarget.nickname || pxt.appTarget.id)}</p>
            </div>
        </Modal>
    );
};
