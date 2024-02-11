import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/HomeScreen.module.scss";
import { Link } from "react-common/components/controls/Link";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { showModal } from "../transforms/showModal";
import { resetRubricAsync } from "../transforms/resetRubricAsync";

const Welcome: React.FC = () => {
    return (
        <div className={css.welcome}>
            <h1>{lf("Welcome to MakeCode Project Insights!")}</h1>
            <p>
                {lf("This tool is designed to help you evaluate student projects using a rubric.")}{" "}
                <Link target="_blank" href="https://makecode.com/teachertool">
                    {lf("Learn More.")}
                </Link>
            </p>
        </div>
    );
};

interface CardProps {
    title: string;
    className?: string;
    icon?: string;
    onClick: () => void;
}

const Card: React.FC<CardProps> = ({ title, className, icon, onClick }) => {
    return (
        <Button className={classList(css.cardButton, className)} title={title} onClick={onClick}>
            <div className={css.cardDiv}>
                {icon && (
                    <div className={css.cardIcon}>
                        <i className={icon}></i>
                    </div>
                )}
                <div className={css.cardTitle}>
                    <h3>{title}</h3>
                </div>
            </div>
        </Button>
    );
};

const GetStarted: React.FC = () => {
    const onNewRubricClickedAsync = async () => {
        pxt.tickEvent("teachertool.newrubric");
        await resetRubricAsync(true);
    };

    const onImportRubricClicked = () => {
        pxt.tickEvent("teachertool.importrubric");
        showModal("import-rubric");
    };

    return (
        <div className={css.getStarted}>
            <h2>{lf("Get Started")}</h2>
            {/* TODO: Replace with carousel */}
            <div className={css.cards}>
                <Card
                    title={lf("New Rubric")}
                    icon={"fas fa-plus-circle"}
                    className={css.newRubric}
                    onClick={onNewRubricClickedAsync}
                />
                <Card
                    title={lf("Import Rubric")}
                    icon={"fas fa-file-upload"}
                    className={css.importRubric}
                    onClick={onImportRubricClicked}
                />
            </div>
        </div>
    );
};

export const HomeScreen: React.FC = () => {
    return (
        <div className={css.page}>
            <div className={css.top} />
            <Welcome />
            <GetStarted />
        </div>
    );
};
