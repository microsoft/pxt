import { stateAndDispatch } from "../state";
import { setActiveImageAsset } from "../state/actions";

export function setActiveImage(assetId: number) {
    const { dispatch } = stateAndDispatch();

    dispatch(setActiveImageAsset(assetId));
}