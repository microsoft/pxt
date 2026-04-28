import { PianoRollThemeProvider, usePianoRollThemeContext } from "./context"
import { Workspace } from "./Workspace"
import { Sidebar } from "./Sidebar"
import { useEffect, useRef, useState } from "react"
import { changeMeasures, changeOctaves, changeTrackInstrument, fromPXTSong, getEmptySong, isDrumInstrument, newTrack, NoteEvent, Song, toPXTSong, Track, updateNoteEvent, updateNoteEvents, updateTrack } from "./types"
import { Header } from "./Header"
import { DeleteTrackModal } from "./DeleteTrackModal"
import { DeleteErrorModal } from "./DeleteErrorModal"
import { DrumWarningModal } from "./DrumWarningModal"
import { isPlaying, startPlaybackAsync, stopPlayback, updatePlaybackSongAsync } from "../musicEditor/playback"
import { PlaybackControls } from "../musicEditor/PlaybackControls"
import { MeasureHeader } from "./MeasureHeader"
import { VelocityEditor } from "./VelocityEditor"
import { fire } from "blockly/core/events/utils"

interface PianoRollProps {
    onStateChanged?: (state: PianoRollState) => void;
    asset?: pxt.assets.music.Song;
    undoStack?: StateSnapshot[];
    redoStack?: StateSnapshot[];
    selectedTrack?: number;
    velocityEditorVisible?: boolean;
}

type modalType = "delete-track" | "delete-error" | "drum-warning";

export const PianoRoll = (props: PianoRollProps) => {
    useEffect(() => {
        return () => {
            stopPlayback();
        }
    }, [])

    return (
        <PianoRollThemeProvider>
            <PianoRollInternal {...props} />
        </PianoRollThemeProvider>
    )
}

export interface PianoRollState {
    undoStack: StateSnapshot[];
    redoStack: StateSnapshot[];
    asset: pxt.assets.music.Song;
    selectedTrack: number;
    velocityEditorVisible: boolean;
}

interface StateSnapshot {
    song: Song;
    selectedTrack: number;
}


const PianoRollInternal = (props: PianoRollProps) => {
    const {
        onStateChanged,
        asset,
        selectedTrack: initialSelectedTrack,
        velocityEditorVisible: initialVelocityEditorVisible,
        undoStack: initialUndoStack,
        redoStack: initialRedoStack
    } = props;
    const { state: theme, dispatch: updateTheme, } = usePianoRollThemeContext();

    const lastFiredState = useRef<PianoRollState | null>(null);

    const [song, setSong] = useState<Song>(asset ? fromPXTSong(asset) : getEmptySong());
    const [selectedTrack, setSelectedTrack] = useState(song.tracks[0].id);
    const [modal, setModal] = useState<{ type: modalType, trackId?: number, instrumentId?: number } | null>(null);

    const [undoStack, setUndoStack] = useState<StateSnapshot[]>(initialUndoStack || []);
    const [redoStack, setRedoStack] = useState<StateSnapshot[]>(initialRedoStack || []);

    const [velocityEditorVisible, setVelocityEditorVisible] = useState(initialVelocityEditorVisible || false);

    useEffect(() => {
        if (asset) {
            const song = fromPXTSong(asset);
            setSong(song);
            setSelectedTrack(song.tracks[0].id);
            setModal(null);
            setUndoStack(initialUndoStack || []);
            setRedoStack(initialRedoStack || []);
            setSelectedTrack(initialSelectedTrack || song.tracks[0].id);
            setVelocityEditorVisible(initialVelocityEditorVisible || false);
            stopPlayback();
            fireStateChange({ asset, undoStack: initialUndoStack || [], redoStack: initialRedoStack || [], selectedTrack: initialSelectedTrack || song.tracks[0].id, velocityEditorVisible: initialVelocityEditorVisible || false })
        }
    }, [asset, onStateChanged])

    // these props might be passed in after the initial mounting of the component,
    // so this use effect ensures that we override the internal state whenever
    // these props change
    useEffect(() => {
        if (initialUndoStack) {
            setUndoStack(initialUndoStack);
        }
        if (initialRedoStack) {
            setRedoStack(initialRedoStack);
        }
        if (initialSelectedTrack !== undefined) {
            setSelectedTrack(initialSelectedTrack);
        }
        if (initialVelocityEditorVisible !== undefined) {
            setVelocityEditorVisible(initialVelocityEditorVisible);
        }
    }, [initialUndoStack, initialRedoStack, initialSelectedTrack, initialVelocityEditorVisible]);

    useEffect(() => {
        if (onStateChanged) {
            fireStateChange({});
        }
    }, [onStateChanged])

    const fireStateChange = (newState: Partial<PianoRollState>) => {
        if (onStateChanged) {
            if (!lastFiredState.current) {
                lastFiredState.current = {
                    asset: toPXTSong(song),
                    undoStack,
                    redoStack,
                    selectedTrack,
                    velocityEditorVisible
                };
            }
            const stateToFire = {
                ...lastFiredState.current,
                ...newState
            };

            onStateChanged(stateToFire);
            lastFiredState.current = stateToFire;
        }
    }

    const updateSong = (newSong: Song) => {
        setUndoStack([...undoStack, { song, selectedTrack }]);
        setRedoStack([])

        setSong(newSong);
        fireStateChange({ asset: toPXTSong(newSong), undoStack: [...undoStack, { song, selectedTrack }], redoStack: [] })

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(newSong));
        }
    }

    const onTrackEdit = (updatedTrack: Track) => {
        updateSong(updateTrack(updatedTrack, song));
    }

    const onTrackSelected = (trackId: number) => {
        setSelectedTrack(trackId);
        fireStateChange({ selectedTrack: trackId });
    }

    const onTrackCreated = () => {
        const newSong = newTrack(song.instruments[0].id, song);
        updateSong(newSong);

        const newTrackId = newSong.tracks[newSong.tracks.length - 1].id;
        setSelectedTrack(newTrackId);
        fireStateChange({ selectedTrack: newTrackId });
    }

    const onTrackDeleted = (trackId: number) => {
        const toDelete = song.tracks.find(t => t.id === trackId);

        if (song.tracks.length === 1) {
            setModal({ type: "delete-error" });
        }
        else if (!toDelete?.events.length) {
            setSelectedTrack(song.tracks[0].id);
            updateSong({
                ...song,
                tracks: song.tracks.filter(t => t.id !== trackId)
            });
        }
        else {
            setModal({ type: "delete-track", trackId });
        }
    }

    const onInstrumentSelected = (trackId: number, instrumentId: number) => {
        const track = song.tracks.find(t => t.id === trackId)!;
        const oldInstrument = song.instruments.find(i => i.id === track.instrumentId)!;
        const newInstrument = song.instruments.find(i => i.id === instrumentId)!;

        if (isDrumInstrument(oldInstrument) !== isDrumInstrument(newInstrument) && track.events.length) {
            setModal({ type: "drum-warning", trackId, instrumentId });
            return;
        }

        setTrackInstrument(trackId, instrumentId);
    }

    const deleteTrack = (trackId: number) => {
        setSelectedTrack(song.tracks[0].id);
        updateSong({
            ...song,
            tracks: song.tracks.filter(t => t.id !== trackId)
        });
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

    const onPlaybackControlsClick = (action: "play" | "stop" | "loop") => {
        if (action === "play") {
            startPlaybackAsync(toPXTSong(song), false);
        }
        else if (action === "loop") {
            startPlaybackAsync(toPXTSong(song), true);
        }
        else {
            stopPlayback();
        }
    }

    const onMeasuresChanged = (newMeasures: number) => {
        updateSong(changeMeasures(newMeasures, song));

        updateTheme({ measures: newMeasures });
    }

    const onTempoChange = (newTempo: number) => {
        updateSong({
            ...song,
            tempo: newTempo
        });
    }

    const onOctavesChanged = (minOctave: number, maxOctave: number) => {
        const track = song.tracks.find(t => t.id === selectedTrack)!;

        if (track.minOctave === minOctave && track.maxOctave === maxOctave) return;

        if (isDrumInstrument(song.instruments.find(i => i.id === track.instrumentId)!)) {
            return;
        }

        updateTheme({ minOctave, maxOctave });
        updateSong(changeOctaves(selectedTrack, minOctave, maxOctave, song));
    }

    const onVelocityChange = (notes: NoteEvent[]) => {
        updateSong(updateNoteEvents(song, selectedTrack, notes));
    }

    const onVelocityEditorToggle = () => {
        setVelocityEditorVisible(!velocityEditorVisible);
        fireStateChange({ velocityEditorVisible: !velocityEditorVisible });
    }

    const undo = () => {
        if (!undoStack.length) return;

        const lastState = undoStack.pop()!;
        redoStack.push({ song, selectedTrack });

        setUndoStack([...undoStack]);
        setRedoStack([...redoStack]);

        setSong(lastState.song);
        setSelectedTrack(lastState.selectedTrack);

        fireStateChange({ asset: toPXTSong(lastState.song), undoStack: [...undoStack], redoStack: [...redoStack] });

        if (lastState.song.measures !== song.measures) {
            updateTheme({ measures: lastState.song.measures });
        }

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(lastState.song));
        }
    }

    const redo = () => {
        if (!redoStack.length) return;

        const nextState = redoStack.pop()!;
        undoStack.push({ song, selectedTrack });

        setUndoStack([...undoStack]);
        setRedoStack([...redoStack]);

        setSong(nextState.song);
        setSelectedTrack(nextState.selectedTrack);

        fireStateChange({ asset: toPXTSong(nextState.song), undoStack: [...undoStack], redoStack: [...redoStack] });

        if (nextState.song.measures !== song.measures) {
            updateTheme({ measures: nextState.song.measures });
        }

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(nextState.song));
        }
    }

    const closeModal = () => setModal(null);

    const track = song.tracks.find(t => t.id === selectedTrack)!;
    const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

    const minOctave = isDrumInstrument(instrument) ? 0 : track.minOctave;
    const maxOctave = isDrumInstrument(instrument) ? 1 : track.maxOctave;

    useEffect(() => {
        if (theme.minOctave !== minOctave || theme.maxOctave !== maxOctave || theme.measures !== song.measures) {
            updateTheme({ minOctave, maxOctave, measures: song.measures });
        }
    }, [minOctave, maxOctave, theme.minOctave, theme.maxOctave, updateTheme, song.measures])

    return (
        <div className="piano-roll">
            {modal?.type === "delete-track" &&
                <DeleteTrackModal trackId={modal.trackId!} onClose={closeModal} onDelete={deleteTrack} />
            }
            {modal?.type === "delete-error" &&
                <DeleteErrorModal onClose={closeModal} />
            }
            {modal?.type === "drum-warning" &&
                <DrumWarningModal trackId={modal.trackId!} instrumentId={modal.instrumentId!} onClose={closeModal} onConfirm={setTrackInstrument} />
            }
            <div className="header-container">
                <Header
                    song={song}
                    selectedTrack={selectedTrack}
                    velocityEditorVisible={velocityEditorVisible}
                    onVelocityEditorToggle={onVelocityEditorToggle}
                    onTrackSelected={onTrackSelected}
                    onInstrumentSelected={onInstrumentSelected}
                    onTrackCreated={onTrackCreated}
                    onTrackDeleted={onTrackDeleted}
                    onOctavesChanged={onOctavesChanged}
                />
            </div>
            <MeasureHeader measures={song.measures} />
            <div className="scroll-container">
                <div className="content-container">
                    <div className="sidebar-container">
                        <Sidebar
                            instrument={instrument}
                            selectedTrack={selectedTrack}
                            minOctave={minOctave}
                            maxOctave={maxOctave}
                        />
                    </div>
                    <div className="workspace-container">
                        <Workspace
                            track={track}
                            onEdit={onTrackEdit}
                            isDrumTrack={isDrumInstrument(instrument)}
                            playNote={playNote}
                            measures={song.measures}
                        />
                    </div>
                </div>
            </div>
            {velocityEditorVisible &&
                <VelocityEditor notes={track.events} onNotesChange={onVelocityChange} />
            }
            <div className="footer">
                <PlaybackControls
                    beatsPerMinute={song.tempo}
                    measures={song.measures}
                    onControlsClick={onPlaybackControlsClick}
                    onTempoChange={onTempoChange}
                    onMeasuresChanged={onMeasuresChanged}
                    hasUndo={undoStack.length > 0}
                    hasRedo={redoStack.length > 0}
                    onUndoClick={undo}
                    onRedoClick={redo}
                    hideBassClefOption={true}
                    singlePlayButton={true}
                />
            </div>
        </div>
    )
}