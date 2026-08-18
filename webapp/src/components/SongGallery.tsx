import { useEffect, useMemo, useState } from "react";
import { songToDataURI } from "../../../pxtblocks";
import { Button } from "../../../react-common/components/controls/Button";
import { FocusTrapRegion } from "../../../react-common/components/controls/FocusTrap";
import { classList } from "../../../react-common/components/util";
import { addPlaybackStateListener, removePlaybackStateListener, startPlaybackAsync, stopPlayback } from "./musicEditor/playback";

interface SongGalleryProps {
    items?: pxt.Asset[];
    hidden: boolean;
    onAssetSelected: (item: pxt.Asset) => void;
    onEscape: () => void;
}

export const SongGallery = (props: SongGalleryProps) => {
    const { items, hidden, onAssetSelected, onEscape } = props;

    const [playingSong, setPlayingSong] = useState<pxt.assets.music.Song | null>(null);

    useEffect(() => {
        const playbackStateListener = (state: "play" | "stop" | "loop") => {
            if (state === "stop") {
                setPlayingSong(null);
            }
        }

        addPlaybackStateListener(playbackStateListener);
        return () => {
            removePlaybackStateListener(playbackStateListener);
        }
    }, []);

    const onPlayClick = (song: pxt.assets.music.Song) => {
        if (playingSong === song) {
            stopPlayback();
            setPlayingSong(null);
        }
        else {
            startPlaybackAsync(song, false);
            setPlayingSong(song);
        }
    };

    return (
        <FocusTrapRegion
            className={classList("image-editor-gallery song", items && !hidden && "visible")}
            enabled={!hidden}
            onEscape={onEscape}
        >
            {!hidden && items?.map((item, index) =>
                <SongGalleryItem
                    key={item.id}
                    asset={item}
                    selected={false}
                    isPlaying={playingSong === (item as pxt.Song).song}
                    onPlayClick={onPlayClick}
                    onClick={() => onAssetSelected(item)}
                />
            )}
        </FocusTrapRegion>
    );
}

interface SongGalleryItemProps {
    asset: pxt.Asset;
    selected: boolean;
    isPlaying: boolean;
    onClick: () => void;
    onPlayClick: (song: pxt.assets.music.Song) => void;
}

const SongGalleryItem = (props: SongGalleryItemProps) => {
    const { asset, selected, isPlaying, onClick, onPlayClick } = props;

    const song = (asset as pxt.Song).song;

    const previewUri = useMemo(() => {
        return songToDataURI((asset as pxt.Song).song, 100, 32, false);
    }, [asset.id]);

    const handlePlayClick = () => {
        onPlayClick(song);
    };

    const isTemporary = !!asset.meta.temporaryInfo;
    const displayName = isTemporary ? lf("{id:song}Untitled") : (asset.meta?.displayName || asset.id.split(".").pop() || asset.id);

    return (
        <div
            className={classList("song-gallery-item", selected && "selected")}
        >
            <Button
                className="song-gallery-item-button"
                title={lf("Select {0}", displayName)}
                label={
                    <>
                        <div className="song-gallery-item-name">{displayName}</div>
                        <div className="song-gallery-item-preview">
                            <img src={previewUri} alt={lf("Preview of {0}", displayName)} />
                        </div>
                    </>
                }
                onClick={onClick}
            />

            <Button
                className="play-button"
                leftIcon={classList("fas", isPlaying ? "fa-stop" : "fa-play")}
                title={isPlaying ? lf("Stop") : lf("Play")}
                onClick={handlePlayClick}
            />
        </div>
    );
}