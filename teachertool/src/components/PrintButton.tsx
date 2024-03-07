import * as React from "react";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Toolbar } from "./Toolbar";

interface PrintButtonProps {
    printRef: React.RefObject<HTMLDivElement>;
    onHandlePrint?: () => void;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ printRef, onHandlePrint }) => {
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    });
    return <Toolbar.Button icon="fas fa-print" title={lf("Print")} onClick={handlePrint} />;
};
