import * as React from "react";
import { useReactToPrint } from "react-to-print";
import { Toolbar } from "./Toolbar";
import { stateAndDispatch } from "../state";
import { showToast } from "../state/actions";
import { makeToast } from "../utils";
import { Strings } from "../constants";
import { getSafeRubricName } from "../state/helpers";

interface PrintButtonProps {
    printRef: React.RefObject<HTMLDivElement>;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ printRef }) => {
    const { state: teacherTool } = stateAndDispatch();
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        onPrintError: () => showToast(makeToast("error", lf("Unable to print evaluation results"), 2000)),
        documentTitle: `${pxt.Util.sanitizeFileName(getSafeRubricName(teacherTool)!)} - ${pxt.Util.sanitizeFileName(
            teacherTool.projectMetadata?.name || Strings.UntitledProject
        )}`,
    });
    return <Toolbar.Button icon="fas fa-print" title={lf("Print")} onClick={handlePrint} />;
};
