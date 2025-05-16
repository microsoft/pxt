import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { ArcadeSimulator } from "./ArcadeSimulator";

export function SimulatorGroup() {
    return (
        <div className={css["group"]}>
            <p className={css["label"]}>{lf("Game")}</p>
            <ArcadeSimulator />
        </div>
    );
}
