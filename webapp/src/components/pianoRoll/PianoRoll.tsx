import { PianoRollThemeProvider, usePianoRollThemeContext } from "./context"
import { Workspace } from "./Workspace"
import { Sidebar } from "./Sidebar"
import { useEffect, useState } from "react"
import { changeTrackInstrument, getEmptySong, isDrumInstrument, Song, toPXTSong, Track, updateTrack } from "./types"
import { Header } from "./Header"
import { DeleteTrackModal } from "./DeleteTrackModal"
import { DeleteErrorModal } from "./DeleteErrorModal"
import { DrumWarningModal } from "./DrumWarningModal"
import { isPlaying, startPlaybackAsync, stopPlayback, updatePlaybackSongAsync } from "../musicEditor/playback"

interface PianoRollProps {

}

type modalType = "delete-track" | "delete-error" | "drum-warning";

export const PianoRoll = (props: PianoRollProps) => {
    return (
        <PianoRollThemeProvider>
            <PianoRollInternal {...props} />
        </PianoRollThemeProvider>
    )
}

const PianoRollInternal = (props: PianoRollProps) => {
    const { state: theme, dispatch: updateTheme } = usePianoRollThemeContext();

    const [song, setSong] = useState<Song>(getEmptySong());
    const [selectedTrack, setSelectedTrack] = useState(song.tracks[0].id);
    const [playing, setPlaying] = useState(false);

    const [modal, setModal] = useState<{ type: modalType, trackId?: number, instrumentId?: number } | null>(null);

    const updateSong = (song: Song) => {
        setSong(song);

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(song));
        }
    }

    const onTrackEdit = (updatedTrack: Track) => {
        updateSong(updateTrack(updatedTrack, song));
    }

    const onTrackSelected = (trackId: number) => {
        setSelectedTrack(trackId);
    }

    const onTrackCreated = () => {
        const newTrack: Track = {
            id: song.nextId++,
            nextId: 0,
            instrumentId: song.instruments[0].id,
            events: []
        }

        updateSong({
            ...song,
            tracks: [...song.tracks, newTrack]
        });

        setSelectedTrack(newTrack.id);
    }

    const onTrackDeleted = (trackId: number) => {
        const toDelete = song.tracks.find(t => t.id === trackId);

        if (song.tracks.length === 1) {
            setModal({ type: "delete-error" });
        }
        else if (!toDelete?.events.length) {
            updateSong({
                ...song,
                tracks: song.tracks.filter(t => t.id !== trackId)
            });

            setSelectedTrack(song.tracks[0].id);
        }
        else {
            setModal({ type: "delete-track", trackId });
        }
    }

    const onInstrumentSelected = (trackId: number, instrumentId: number) => {
        const track = song.tracks.find(t => t.id === trackId)!;
        const oldInstrument = song.instruments.find(i => i.id === track.instrumentId)!;
        const newInstrument = song.instruments.find(i => i.id === instrumentId)!;

        if (isDrumInstrument(oldInstrument) && !isDrumInstrument(newInstrument) && track.events.length) {
            setModal({ type: "drum-warning", trackId, instrumentId });
            return;
        }

        setTrackInstrument(trackId, instrumentId);
    }

    const deleteTrack = (trackId: number) => {
        updateSong({
            ...song,
            tracks: song.tracks.filter(t => t.id !== trackId)
        });

        setSelectedTrack(song.tracks[0].id);
    }

    const setTrackInstrument = (trackId: number, instrumentId: number) => {
        updateSong(changeTrackInstrument(trackId, instrumentId, song));
    }

    const playNote = (note: number) => {
        const track = song.tracks.find(t => t.id === selectedTrack)!;
        const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

        if (isDrumInstrument(instrument)) {
            const drum = instrument.drums[note];
            pxsim.music.playDrumAsync(drum)
        }
        else {
            pxsim.music.playNoteAsync(note, instrument.instrument, 300)
        }
    }

    const togglePlaying = () => {
        if (playing) {
            stopPlayback();
        }
        else {
            startPlaybackAsync(toPXTSong(song), true);
        }

        setPlaying(!playing);
    }

    const closeModal = () => setModal(null);

    const track = song.tracks.find(t => t.id === selectedTrack)!;
    const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

    useEffect(() => {
        if (theme.minOctave !== instrument.minOctave || theme.maxOctave !== instrument.maxOctave) {
            updateTheme({ minOctave: instrument.minOctave, maxOctave: instrument.maxOctave });
        }
    }, [instrument.minOctave, instrument.maxOctave, theme.minOctave, theme.maxOctave, updateTheme])

    return (
        <div className="piano-roll">
            { modal?.type === "delete-track" &&
                <DeleteTrackModal trackId={modal.trackId!} onClose={closeModal} onDelete={deleteTrack} />
            }
            { modal?.type === "delete-error" &&
                <DeleteErrorModal onClose={closeModal} />
            }
            { modal?.type === "drum-warning" &&
                <DrumWarningModal trackId={modal.trackId!} instrumentId={modal.instrumentId!} onClose={closeModal} onConfirm={setTrackInstrument} />
            }
            <div className="header-container">
                <Header
                    song={song}
                    selectedTrack={selectedTrack}
                    onTrackSelected={onTrackSelected}
                    onInstrumentSelected={onInstrumentSelected}
                    onTrackCreated={onTrackCreated}
                    onTrackDeleted={onTrackDeleted}
                    togglePlaying={togglePlaying}
                    playing={playing}
                />
            </div>
            <div className="scroll-container">
                <div className="content-container">
                    <div className="sidebar-container">
                        <Sidebar instrument={instrument} selectedTrack={selectedTrack} />
                    </div>
                    <div className="workspace-container">
                        <Workspace
                            track={track}
                            onEdit={onTrackEdit}
                            isDrumTrack={isDrumInstrument(instrument)}
                            playNote={playNote}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}