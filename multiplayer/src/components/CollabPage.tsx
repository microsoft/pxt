import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { netMode, clientRole, collabInfo } = state;

    if (!collabInfo) return null;
    if (netMode !== "connected") return null;

    return (
        <>
        {collabInfo.joinCode}
        </>
    );
}
