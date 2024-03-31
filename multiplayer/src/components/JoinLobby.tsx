import PresenceBar from "./PresenceBar";

export default function Render() {
    return (
        <div className="tw-bg-white tw-shadow-lg tw-rounded-lg tw-m-1">
            <div className="tw-flex tw-flex-col tw-items-center tw-py-[2rem] tw-px-[1.5rem] sm:tw-px-[3.5rem] md:tw-px-[6rem]">
                <div className="tw-font-bold tw-text-2xl tw-text-neutral-800">{lf("Waiting for players")}</div>
                <div className="tw-mt-3 tw-text-center tw-text-neutral-700">
                    {lf("Your host will start the game soon!")}
                </div>
                <div className="tw-mt-5">
                    <PresenceBar />
                </div>
            </div>
        </div>
    );
}
