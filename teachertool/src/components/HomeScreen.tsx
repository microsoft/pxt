import * as React from "react";
import css from "./styling/HomeScreen.module.scss";
import { Link } from "react-common/components/controls/Link";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { showModal } from "../transforms/showModal";
import { resetRubricAsync } from "../transforms/resetRubricAsync";
import { Constants, Strings, Ticks } from "../constants";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation } from "swiper";

import "swiper/scss";
import "swiper/scss/navigation";
import "swiper/scss/mousewheel";

const Welcome: React.FC = () => {
    return (
        <div className={css.welcome}>
            <h1>{lf("Welcome to MakeCode Project Insights!")}</h1>
            <p>
                {lf("This tool is designed to help you evaluate student projects using a rubric.")}{" "}
                <Link target="_blank" href={Constants.LearnMoreLink}>
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
        <div className={css.cardContainer}>
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
        </div>
    );
};

interface CarouselProps extends React.PropsWithChildren<{}> {}

const Carousel: React.FC<CarouselProps> = ({ children }) => {
    const cards = React.Children.toArray(children);

    return (
        <Swiper
            spaceBetween={0}
            slidesPerView={"auto"}
            allowTouchMove={true}
            slidesOffsetBefore={32}
            navigation={true}
            mousewheel={true}
            modules={[Navigation, Mousewheel]}
            className={css.swiperCarousel}
        >
            {cards.map((card, index) => (
                <SwiperSlide key={index} className={css.swiperSlide}>
                    {card}
                </SwiperSlide>
            ))}
        </Swiper>
    );
};

const GetStarted: React.FC = () => {
    const onNewRubricClickedAsync = async () => {
        pxt.tickEvent(Ticks.NewRubric);
        await resetRubricAsync(true);
    };

    const onImportRubricClicked = () => {
        pxt.tickEvent(Ticks.ImportRubric);
        showModal("import-rubric");
    };

    return (
        <div className={css.carouselRow}>
            <div className={css.rowTitle}>
                <h2>{lf("Get Started")}</h2>
            </div>
            <Carousel>
                <Card
                    title={Strings.NewRubric}
                    icon={"fas fa-plus-circle"}
                    className={css.newRubric}
                    onClick={onNewRubricClickedAsync}
                />
                <Card
                    title={Strings.ImportRubric}
                    icon={"fas fa-file-upload"}
                    className={css.importRubric}
                    onClick={onImportRubricClicked}
                />
            </Carousel>
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
