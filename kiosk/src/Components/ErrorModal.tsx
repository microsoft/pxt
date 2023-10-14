import { Button } from "../../../react-common/components/controls/Button";

interface IProps {
    errorType: string;
    errorDescription: string;
    setShowing: (p: string) => void;
}
const ErrorModal: React.FC<IProps> = ({
    errorType,
    errorDescription,
    setShowing,
}) => {
    const cancelClicked = () => {
        pxt.tickEvent("kiosk.scanError.dismissed");
        setShowing("");
    };

    return (
        <div className="common-modal-container error">
            <div className="common-modal">
                <div>
                    <div className="common-modal-header common-modal-title error">
                        {errorType}
                    </div>
                    <div className="common-modal-body error">
                        <p>{errorDescription}</p>
                    </div>
                    <div className="common-modal-footer">
                        <Button
                            title={lf("Okay")}
                            label={lf("Okay")}
                            className={`common-modal-button confirm error`}
                            onClick={cancelClicked}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
