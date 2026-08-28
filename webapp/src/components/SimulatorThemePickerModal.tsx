import * as React from "react";

import {
    SimulatorThemePickerModal as SharedSimulatorThemePickerModal,
    SimulatorThemePickerModalProps as SharedSimulatorThemePickerModalProps,
} from "../../../react-common/components/theming/SimulatorThemePickerModal";
import * as simulator from "../simulator";

export type SimulatorThemePickerModalProps = Omit<SharedSimulatorThemePickerModalProps, "renderPreview">;

export const SimulatorThemePickerModal = (props: SimulatorThemePickerModalProps) => {
    return <SharedSimulatorThemePickerModal
        {...props}
        renderPreview={theme => <WebappSimulatorThemePreview theme={theme} />} />;
};

interface WebappSimulatorThemePreviewProps {
    theme: pxt.SimulatorTheme;
}

const WebappSimulatorThemePreview = (props: WebappSimulatorThemePreviewProps) => {
    const { theme } = props;
    const previewContainer = React.useRef<HTMLDivElement>();
    const currentTheme = React.useRef(theme);

    React.useEffect(() => {
        currentTheme.current = theme;
        simulator.setPreviewSimulatorTheme(theme);
    }, [theme]);

    React.useEffect(() => {
        const loanedSimulator = simulator.driver?.loanSimulator();
        const container = previewContainer.current;
        if (!loanedSimulator || !container) return undefined;

        container.appendChild(loanedSimulator);
        const frame = loanedSimulator.querySelector("iframe");
        const onLoad = () => simulator.setPreviewSimulatorTheme(currentTheme.current);
        frame?.addEventListener("load", onLoad);
        simulator.setPreviewSimulatorTheme(currentTheme.current);

        return () => {
            frame?.removeEventListener("load", onLoad);
            simulator.driver?.unloanSimulator();
            simulator.clearPreviewSimulatorTheme();
        };
    }, []);

    return <div className="simulator-theme-preview" role="group" aria-label={lf("Simulator theme preview")}>
        <div ref={previewContainer} />
    </div>;
};
