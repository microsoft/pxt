import { classList } from "react-common/components/util";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/NoticeLabel.module.scss";

export type NoticeLabelSeverity = "info" | "warning" | "neutral";

export interface INoticeLabelProps extends React.PropsWithChildren<{}> {
    severity: NoticeLabelSeverity;
}

export const NoticeLabel: React.FC<INoticeLabelProps> = props => {
    const iconClass = props.severity == "neutral" ? undefined : (props.severity === "warning" ? "fas fa-exclamation-triangle" : "fas fa-exclamation-circle");
    return (
        <div className={css["notice-label-background"]}>
            <div className={classList(css["notice-label-container"], css[`${props.severity}-notice-label-container`])}>
                {props.severity !== "info" && <i className={classList(iconClass, css["icon"])} />}
                <label className="notice-label">{props.children}</label>
            </div>
        </div>
    );
};
