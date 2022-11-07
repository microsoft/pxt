import { useEffect, useContext } from "react";
import { showModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { useAuthDialogMessages } from "../hooks/useAuthDialogMessages";

export default function Render() {
    const { dispatch } = useContext(AppStateContext);

    const dialogMessages = useAuthDialogMessages();

    useEffect(() => {
        dispatch(showModal("sign-in", { dialogMessages }));
    }, [dialogMessages]);

    return <></>;
}
