import { getCollabCanvas } from "../../services/collabCanvas";
import { collabStateAndDispatch } from "../../state/collab";
import * as CollabActions from "../../state/collab/actions";

export function initState() {
    const { dispatch } = collabStateAndDispatch();
    dispatch(CollabActions.init());
}
