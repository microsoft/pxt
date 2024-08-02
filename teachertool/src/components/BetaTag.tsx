import css from "./styling/BetaTag.module.scss";

interface IBetaTagProps {};
const BetaTag: React.FC<IBetaTagProps> = () => {
    return <span className={css["beta-tag"]}>{lf("Beta")}</span>;
}
