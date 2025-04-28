import css from "./styling/MainPanel.module.scss";
import { useContext, useEffect } from "react";
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { motion } from "framer-motion";
import { Strings } from "@/constants";
import { showModal, hostNewGameAsync } from "@/transforms";
import { HostView } from "@/components/HostView";
import { GuestView } from "@/components/GuestView";
import { getClientRole } from "@/state/helpers";
import { generateRandomName } from "@/utils";
import { setNetState } from "@/state/actions";

interface ActionCardProps {
    description: string;
    buttonLabel: string;
    icon?: string;
    classes?: string;
    onClick: () => void;
}

function ActionCard({ description, buttonLabel, icon, classes, onClick }: ActionCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, mass: 0.75 }}
            role="button"
            tabIndex={1}
            className={classList(css["action-card"], classes)}
            onClick={onClick}
        >
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
                onClick={async () => {
                    const initialKv = new Map<string, string>();
                    initialKv.set("name", generateRandomName());
                    await hostNewGameAsync(initialKv);
                }}
            />
            <ActionCard
                description={Strings.JoinGameDescription}
                buttonLabel={Strings.JoinGameLabel}
                icon="fas fa-plug"
                classes={css["join"]}
                onClick={() => {
                    showModal({ type: "join-game" });
                }}
            />
            <ActionCard
                description={Strings.BuildGameDescription}
                buttonLabel={Strings.BuildGameLabel}
                icon="fas fa-tools"
                classes={css["build"]}
                onClick={() => {}}
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
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const { authStatus, modalOptions } = state;
    const clientRole = getClientRole(context);

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

    if (clientRole === "none") {
        return (
            <div className={css["main-panel"]}>
                <ActionCards />
                <GalleryCarousel />
            </div>
        );
    }

    if (clientRole === "host") {
        return (
            <div className={css["main-panel"]}>
                <HostView />
            </div>
        );
    }

    if (clientRole === "guest") {
        return (
            <div className={css["main-panel"]}>
                <GuestView />
            </div>
        );
    }

    // Should never happen
    debugger;
    dispatch(setNetState(undefined));

    return null;
}
