import PresenceBar from "./PresenceBar";

export default function Render() {
    return (
        <div>
            <div className="tw-flex tw-flex-col tw-items-center tw-bg-white tw-py-[2rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
                <div className="tw-font-segoueUI tw-font-bold tw-text-2xl tw-text-neutral-800">
                    {lf("Waiting for players")}
                </div>
                <div className="tw-font-segoueUI tw-mt-3 tw-text-center tw-text-neutral-700">
                    {lf("Your host will start the game soon!")}
                </div>
                <div className="tw-mt-5">
                    <PresenceBar />
                </div>
            </div>
        </div>
    );
}
