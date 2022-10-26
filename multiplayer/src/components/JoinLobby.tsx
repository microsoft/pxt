import PresenceBar from "./PresenceBar";

export default function Render() {
    return (
        <div>
            <div className="tw-flex tw-flex-col tw-items-center tw-text-lg tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
                <div className="tw-flex tw-flex-col tw-items-center tw-space-y-3">
                    <div>{lf("Waiting for players.")}</div>
                    <div>{lf("Your host will start the game soon.")}</div>
                </div>
                <div className="tw-mt-5">
                    <PresenceBar />
                </div>
            </div>
        </div>
    );
}
