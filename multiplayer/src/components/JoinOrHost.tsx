import JoinOrHostGame from "./JoinOrHostGame";
import JoinOrHostCollab from "./JoinOrHostCollab";
import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    return state.collabMode ? <JoinOrHostCollab /> : <JoinOrHostGame />;
}
