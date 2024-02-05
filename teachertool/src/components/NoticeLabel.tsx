import { classList } from "react-common/components/util";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/NoticeLabel.module.scss";

export type NoticeLabelSeverity = "info" | "warning" | "error" | "neutral";

export interface INoticeLabelProps extends React.PropsWithChildren<{}> {
    severity: NoticeLabelSeverity;
}

export const NoticeLabel: React.FC<INoticeLabelProps> = props => {
    let iconClass = undefined;
    switch (props.severity) {
        case "info":
            iconClass = "fas fa-exclamation-circle";
            break;
        case "warning":
            iconClass = "fas fa-exclamation-triangle";
            break;
        case "error":
            iconClass = "fas fa-times";
            break;
        case "neutral":
        default:
            // no icon
            break;
    }

    return (
        <div className={css["notice-label-background"]}>
            <div className={classList(css["notice-label-container"], css[`${props.severity}-notice-label-container`])}>
                {props.severity !== "neutral" && <i className={classList(iconClass, css["icon"])} />}
                <label className="notice-label">{props.children}</label>
            </div>
        </div>
    );
};
