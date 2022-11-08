import { Button } from "react-common/components/controls/Button";
import { hostGameAsync } from "../epics/hostGameAsync";
import { cleanupShareCode } from "../util";

export default function Render(props: {
    shareId: string;
    title: string;
    subtitle: string;
    image?: string;
}) {
    const { title, subtitle, image } = props;
    const shareCode = cleanupShareCode(props.shareId)!;

    const hostGame = async () => {
        pxt.tickEvent("mp.hostbutton", { id: shareCode, title: title });
        await hostGameAsync(shareCode);
    };

    const buttonTitle = lf(
        'Host a multiplayer session with "{0}"',
        pxt.U.rlf(title)
    );
    const bkgdImage = image ?? `https://makecode.com/api/${shareCode}/thumb`;
    const thumbnailAltText = lf("Preview image for game");

    return (
        <Button
            className="tw-p-0 tw-rounded-md tw-border-solid tw-border-1 tw-border-gray-300 tw-overflow-hidden tw-drop-shadow-xl"
            onClick={hostGame}
            title={buttonTitle}
            label={
                <>
                    <img
                        className="tw-max-w-[12em] tw-h-auto tw-aspect-[4/3]"
                        src={bkgdImage}
                        alt={thumbnailAltText}
                    />
                    <div className="tw-text-left tw-px-2 tw-pt-1">
                        {pxt.U.rlf(title)}
                    </div>
                    <div className="tw-text-left tw-px-2 tw-pb-1 tw-text-sm tw-text-gray-500">
                        {pxt.U.rlf(subtitle)}
                    </div>
                </>
            }
        />
    );
}
