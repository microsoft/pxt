import "swiper/scss";
import "swiper/scss/navigation";
import "swiper/scss/mousewheel";

import * as React from "react";
import { useContext, useState } from "react";
import css from "./styling/HomeScreen.module.scss";
import { Link } from "react-common/components/controls/Link";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { showModal } from "../transforms/showModal";
import { resetChecklistAsync } from "../transforms/resetChecklistAsync";
import { loadChecklistAsync } from "../transforms/loadChecklistAsync";
import { Constants, Strings, Ticks } from "../constants";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation } from "swiper";
import { AppStateContext } from "../state/appStateContext";
import { CarouselCardSet, RequestStatus } from "../types";
import { useJsonDocRequest } from "../hooks/useJsonDocRequest";
import { isChecklistResourceCard } from "../utils";
import { ImportChecklistOptions } from "../types/modalOptions";

const Welcome: React.FC = () => {
    return (
        <div className={css.welcome}>
            <h1>{lf("Welcome to MakeCode Code Evaluation!")}</h1>
            <p>
                {lf("This tool is designed to help you evaluate student projects using an automated checklist.")}{" "}
                <Link target="_blank" href={Constants.LearnMoreLink}>
                    {lf("Learn More.")}
                </Link>
            </p>
        </div>
    );
};

interface IconCardProps {
    title: string;
    className?: string;
    icon?: string;
    onClick: () => void;
}

const IconCard: React.FC<IconCardProps> = ({ title, className, icon, onClick }) => {
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

interface LoadingCardProps {
    delay?: boolean;
}

const LoadingCard: React.FC<LoadingCardProps> = ({ delay }) => {
    return (
        <div className={css.cardContainer}>
            <Button
                className={classList(css.cardButton, css.loadingGradient, delay ? css.loadingGradientDelay : undefined)}
                title={""}
                onClick={() => {}}
            >
                <div className={css.cardDiv}>
                    <div className={css.loadingGradient}></div>
                </div>
            </Button>
        </div>
    );
};

interface ChecklistResourceCardProps {
    cardTitle: string;
    imageUrl: string;
    checklistUrl: string;
}

const ChecklistResourceCard: React.FC<ChecklistResourceCardProps> = ({ cardTitle, imageUrl, checklistUrl }) => {
    const onCardClickedAsync = async () => {
        await loadChecklistAsync(checklistUrl);
    };
    return (
        <div className={css.cardContainer}>
            <Button
                className={classList(css.cardButton, css.checklistResource)}
                title={cardTitle}
                onClick={onCardClickedAsync}
            >
                <div
                    className={classList(css.cardDiv)}
                    style={{
                        backgroundImage: `url("${imageUrl}")`,
                        backgroundSize: "cover",
                    }}
                >
                    <div className={classList(css.cardTitle, css.checklistResourceCardTitle)}>
                        <h3>{cardTitle}</h3>
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
            mousewheel={{
                forceToAxis: true,
            }}
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
    const onNewChecklistClickedAsync = async () => {
        pxt.tickEvent(Ticks.NewChecklist);
        await resetChecklistAsync();
    };

    const onImportChecklistClicked = () => {
        pxt.tickEvent(Ticks.ImportChecklistOpen);
        showModal({ modal: "import-checklist" } as ImportChecklistOptions);
    };

    return (
        <div className={css.carouselRow}>
            <div className={css.rowTitle}>
                <h2>{lf("Get Started")}</h2>
            </div>
            <Carousel>
                <IconCard
                    title={Strings.NewChecklist}
                    icon={"fas fa-plus-circle"}
                    className={css.newChecklist}
                    onClick={onNewChecklistClickedAsync}
                />
                <IconCard
                    title={Strings.ImportChecklist}
                    icon={"fas fa-file-upload"}
                    className={css.importChecklist}
                    onClick={onImportChecklistClicked}
                />
            </Carousel>
        </div>
    );
};

interface DataCarouselProps {
    title: string;
    cardsUrl: string;
}

const CardCarousel: React.FC<DataCarouselProps> = ({ title, cardsUrl }) => {
    const [cardSet, setCardSet] = useState<CarouselCardSet | undefined>();
    const [fetchStatus, setFetchStatus] = useState<RequestStatus | undefined>();

    useJsonDocRequest(cardsUrl, setFetchStatus, setCardSet);

    return !!cardSet?.cards?.length ? (
        <>
            <div className={css.carouselRow}>
                <div className={css.rowTitle}>
                    <h2>{title}</h2>
                </div>
                {(fetchStatus === "loading" || fetchStatus === "error") && (
                    <Carousel>
                        <LoadingCard />
                        <LoadingCard delay={true} />
                    </Carousel>
                )}
                {fetchStatus === "success" && (
                    <Carousel>
                        {cardSet?.cards.map((card, index) => {
                            if (isChecklistResourceCard(card)) {
                                return <ChecklistResourceCard key={index} {...card} />;
                            } else {
                                return <LoadingCard />;
                            }
                        })}
                    </Carousel>
                )}
            </div>
        </>
    ) : null;
};

const CardCarousels: React.FC = () => {
    const { state } = useContext(AppStateContext);
    const { targetConfig } = state;
    const teachertool = targetConfig?.teachertool;
    const carousels = teachertool?.carousels;

    return (
        <>
            {carousels?.map((carousel, index) => (
                <CardCarousel key={index} title={carousel.title} cardsUrl={carousel.cardsUrl} />
            ))}
        </>
    );
};

export const HomeScreen: React.FC = () => {
    return (
        <div className={css.page}>
            <Welcome />
            <GetStarted />
            <CardCarousels />
        </div>
    );
};
