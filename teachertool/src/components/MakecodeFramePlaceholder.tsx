/// <reference path="../../../localtypings/pxteditor.d.ts" />

import css from "./styling/MakecodeFramePlaceholder.module.scss";

interface IProps {}
export const MakeCodeFramePlaceholder: React.FC<IProps> = () => {
    return (
        <div className={css["makecode-frame-placeholder"]}>
            <i className="far fa-hand-point-up" />
            <span>{lf("No project loaded.")}</span>
            <span>{lf("Enter a share link above to evaluate!")}</span>
        </div>
    );
};
