import css from "./MainPanel.module.scss";
import { useContext, useEffect } from "react";
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { motion } from "framer-motion";
import { Strings } from "@/constants";
import { showModal } from "@/transforms";

interface ActionCardProps {
    description: string;
    buttonLabel: string;
    icon?: string;
    classes?: string;
    onClick: () => void;
}

function ActionCard({
    description,
    buttonLabel,
    icon,
    classes,
    onClick
}: ActionCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, mass: 0.75 }}
            role="button" tabIndex={1} className={classList(css["action-card"], classes)} onClick={onClick}>
            <p className={css["label"]}>{buttonLabel}</p>
            <span className={css["icon"]}>
                <i className={icon} />
            </span>
            <p className={css["description"]}>{description}</p>
        </motion.div>
    );
}

function ActionCards() {
    return (
        <div className={css["action-cards"]}>
            <ActionCard
                description={Strings.HostGameDescription}
                buttonLabel={Strings.HostGameLabel}
                icon="fas fa-gamepad"
                classes={css["host"]}
                onClick={() => {
                    showModal({ type: "host-or-join-game", tab: "host" });
                }}
            />
            <ActionCard
                description={Strings.JoinGameDescription}
                buttonLabel={Strings.JoinGameLabel}
                icon="fas fa-plug"
                classes={css["join"]}
                onClick={() => {
                    showModal({ type: "host-or-join-game", tab: "join" });
                }}
            />
            <ActionCard
                description={Strings.BuildGameDescription}
                buttonLabel={Strings.BuildGameLabel}
                icon="fas fa-tools"
                classes={css["build"]}
                onClick={() => { }}
            />
        </div>
    );
}

function GalleryCarousel() {
    return (
        <div className={css["gallery-carousel"]}>
            <p className={css["gallery-title"]}>{Strings.GameGalleryTitle}</p>
            {/* Placeholder for carousel */}
            <div className={css["carousel"]}>[Carousel Placeholder]</div>
        </div>
    );
}

export function MainPanel() {
    const { state } = useContext(AppStateContext);
    const { authStatus, netMode, clientRole, modalOptions } = state;

    useEffect(() => {
        // For now just show the sign-in modal if not signed in.
        // Later we can improve the signed-out experience.
        if (authStatus !== "signed-in" && !modalOptions) {
            showModal({ type: "sign-in" });
        }
    }, [authStatus, modalOptions]);

    if (authStatus !== "signed-in") {
        return null;
    }

    if (netMode === "init" && clientRole === "none") {
        return (
            <div className={css["main-panel"]}>
                <ActionCards />
                <GalleryCarousel />
            </div>
        );
    }

    return null;
}
