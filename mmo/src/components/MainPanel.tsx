import css from "./MainPanel.module.scss";
import { useContext, useEffect } from "react";
import { AppStateContext } from "@/state/Context";
import { showModal } from "@/transforms";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { AnimatePresence, motion } from "framer-motion";

interface ActionCardProps {
    title: string;
    description: string;
    buttonLabel: string;
    classes?: string;
    onClick: () => void;
}

function ActionCard({
    title,
    description,
    buttonLabel,
    classes,
    onClick
}: ActionCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, mass: 0.75 }}
            role="button" tabIndex={1} className={classList(css["action-card"], classes)} onClick={onClick}>
            <p className={css["action-card-label"]}>{buttonLabel}</p>
            <p className={css["action-card-description"]}>{description}</p>
        </motion.div>
    );
}

function ActionCards() {
    return (
        <div className={css["action-cards"]}>
            <ActionCard
                title="Host a Game"
                description="Start a new game and invite your friends to join."
                buttonLabel="Host"
                classes={css["host"]}
                onClick={() => { }}
            />
            <ActionCard
                title="Join a Game"
                description="Enter the game code to join an existing game."
                buttonLabel="Join"
                classes={css["join"]}
                onClick={() => { }}
            />
            <ActionCard
                title="Build a Game"
                description="Create your own game in MakeCode Arcade."
                buttonLabel="Build"
                classes={css["build"]}
                onClick={() => { }}
            />
        </div>
    );
}

function GalleryCarousel() {
    return (
        <div className={css["gallery-carousel"]}>
            <h2>Gallery</h2>
            <p>Check out the latest games and creations from our community.</p>
            {/* Placeholder for carousel */}
            <div className={css["carousel"]}>[Carousel Placeholder]</div>
        </div>
    );
}

export function MainPanel() {
    const { state } = useContext(AppStateContext);
    const { authStatus, netMode, clientRole } = state;

    if (authStatus !== "signed-in") {
        return null;
    }

    if (netMode === "init" && clientRole === "none") {
        return (
            <div className={css["main-panel"]}>
                <ActionCards />
            </div>
        );
    }

    return null;
}
