import Presence from "./Presence";
import Reactions from "./Reactions";

export default function Render() {
    return (
        <div className="tw-flex tw-flex-row tw-space-x-2 tw-items-center tw-align-middle tw-justify-center">
            <Reactions />
            <Presence />
        </div>
    );
}
