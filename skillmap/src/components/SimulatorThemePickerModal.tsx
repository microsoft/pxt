import * as React from "react";

import {
    SimulatorThemePickerModal as SharedSimulatorThemePickerModal,
    SimulatorThemePickerModalProps as SharedSimulatorThemePickerModalProps,
} from "../../../react-common/components/theming/SimulatorThemePickerModal";
import { isLocal } from "../lib/browserUtils";

export type SimulatorThemePickerModalProps = Omit<SharedSimulatorThemePickerModalProps, "renderPreview">;

export const SimulatorThemePickerModal = (props: SimulatorThemePickerModalProps) => {
    return <SharedSimulatorThemePickerModal
        {...props}
        renderPreview={theme => <SkillmapSimulatorThemePreview theme={theme} />} />;
};

interface SkillmapSimulatorThemePreviewProps {
    theme: pxt.SimulatorTheme;
}

const SkillmapSimulatorThemePreview = (props: SkillmapSimulatorThemePreviewProps) => {
    const { theme } = props;
    const frame = React.useRef<HTMLIFrameElement>(null);
    const simulatorUrl = getSimulatorUrl();
    const loadedSimulatorUrl = React.useRef<string>();

    const applyTheme = () => {
        if (loadedSimulatorUrl.current !== simulatorUrl || !frame.current?.contentWindow) return;
        frame.current.contentWindow.postMessage({
            type: "setsimtheme",
            theme,
        } as pxsim.SimulatorMessage & { type: "setsimtheme"; theme: pxt.SimulatorTheme }, new URL(simulatorUrl).origin);
    };

    React.useEffect(applyTheme, [theme, simulatorUrl]);

    // The trusted target simulator requires both permissions for its script-driven UI.
    /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
    return <div className="simulator-theme-preview" role="group" aria-label={lf("Simulator theme preview")}>
        <div className="simframe ui embed">
            <iframe
                ref={frame}
                src={simulatorUrl}
                title={lf("Simulator theme preview")}
                sandbox="allow-same-origin allow-scripts"
                onLoad={() => {
                    loadedSimulatorUrl.current = simulatorUrl;
                    applyTheme();
                }} />
        </div>
    </div>;
    /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
};

function getSimulatorUrl(): string {
    if (isLocal()) return "http://localhost:3232/sim/simulator.html";
    const configuredUrl = pxt.webConfig?.simUrl || (window as any).pxtConfig?.simUrl;
    return new URL(configuredUrl || "/sim/simulator.html", window.location.origin).toString();
}
