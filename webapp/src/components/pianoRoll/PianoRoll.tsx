import { PianoRollTheme, PianoRollThemeProvider, usePianoRollThemeContext } from "./context"
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
import { EditControls } from "../musicEditor/EditControls"

interface PianoRollProps {
    onStateChanged?: (state: PianoRollState) => void;
    asset?: pxt.assets.music.Song;
    undoStack?: StateSnapshot[];
    redoStack?: StateSnapshot[];
    selectedTrackIndex?: number;
    velocityEditorVisible?: boolean;
    showEditControls?: boolean;
    name?: string;
    onDoneClicked?: () => void;
    fieldEditorParams?: FieldEditorParams;
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
    selectedTrackIndex: number;
    velocityEditorVisible: boolean;
    name?: string;
}

export interface FieldEditorParams {
    hideHeader?: boolean;
    maxPolyphony?: number;
    borderColor?: string;
    minOctave?: number;
    maxOctave?: number;
}

interface StateSnapshot {
    song: Song;
    selectedTrackIndex: number;
}


const PianoRollInternal = (props: PianoRollProps) => {
    const {
        onStateChanged,
        asset,
        selectedTrackIndex: initialSelectedTrackIndex,
        velocityEditorVisible: initialVelocityEditorVisible,
        undoStack: initialUndoStack,
        redoStack: initialRedoStack,
        name: initialName,
        showEditControls,
        onDoneClicked,
        fieldEditorParams
    } = props;
    const { state: theme, dispatch: updateTheme, } = usePianoRollThemeContext();

    const lastFiredState = useRef<PianoRollState | null>(null);

    const [song, setSong] = useState<Song>(asset ? fromPXTSong(asset) : getEmptySong());
    const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
    const [modal, setModal] = useState<{ type: modalType, trackId?: number, instrumentId?: number } | null>(null);

    const [undoStack, setUndoStack] = useState<StateSnapshot[]>(initialUndoStack || []);
    const [redoStack, setRedoStack] = useState<StateSnapshot[]>(initialRedoStack || []);
    const [name, setName] = useState(initialName || undefined);

    const [velocityEditorVisible, setVelocityEditorVisible] = useState(initialVelocityEditorVisible || false);

    useEffect(() => {
        if (asset) {
            const song = fromPXTSong(asset);
            setSong(song);
            setModal(null);
            setUndoStack(initialUndoStack || []);
            setRedoStack(initialRedoStack || []);
            setSelectedTrackIndex(initialSelectedTrackIndex || 0);
            setVelocityEditorVisible(initialVelocityEditorVisible || false);
            stopPlayback();
            fireStateChange({ asset, undoStack: initialUndoStack || [], redoStack: initialRedoStack || [], selectedTrackIndex: initialSelectedTrackIndex || 0, velocityEditorVisible: initialVelocityEditorVisible || false })
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
        if (initialSelectedTrackIndex !== undefined) {
            setSelectedTrackIndex(initialSelectedTrackIndex);
        }
        if (initialVelocityEditorVisible !== undefined) {
            setVelocityEditorVisible(initialVelocityEditorVisible);
        }
        setName(initialName);
    }, [initialUndoStack, initialRedoStack, initialSelectedTrackIndex, initialVelocityEditorVisible, initialName]);

    useEffect(() => {
        if (onStateChanged) {
            fireStateChange({});
        }
    }, [onStateChanged])

    useEffect(() => {
        const newTheme: Partial<PianoRollTheme> = {};

        if (fieldEditorParams?.maxPolyphony) {
            newTheme.maxPolyphony = fieldEditorParams.maxPolyphony;
        }

        if (fieldEditorParams?.borderColor) {
            newTheme.borderColor = fieldEditorParams.borderColor;
        }

        updateTheme(newTheme);
    }, [fieldEditorParams, updateTheme])

    const fireStateChange = (newState: Partial<PianoRollState>) => {
        if (onStateChanged) {
            if (!lastFiredState.current) {
                lastFiredState.current = {
                    asset: toPXTSong(song),
                    undoStack,
                    redoStack,
                    selectedTrackIndex,
                    velocityEditorVisible,
                    name
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
        setUndoStack([...undoStack, { song, selectedTrackIndex }]);
        setRedoStack([])

        setSong(newSong);
        fireStateChange({ asset: toPXTSong(newSong), undoStack: [...undoStack, { song, selectedTrackIndex }], redoStack: [] })

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(newSong));
        }
    }

    const onTrackEdit = (updatedTrack: Track) => {
        updateSong(updateTrack(updatedTrack, song));
    }

    const onTrackSelected = (trackId: number) => {
        const index = song.tracks.findIndex(t => t.id === trackId);
        setSelectedTrackIndex(index);
        fireStateChange({ selectedTrackIndex: index });
    }

    const onTrackCreated = () => {
        const newSong = newTrack(song.instruments[0].id, song);
        updateSong(newSong);

        const newTrackIndex = newSong.tracks.length - 1;
        setSelectedTrackIndex(newTrackIndex);
        fireStateChange({ selectedTrackIndex: newTrackIndex });
    }

    const onTrackDeleted = (trackId: number) => {
        const toDelete = song.tracks.find(t => t.id === trackId);

        if (song.tracks.length === 1) {
            setModal({ type: "delete-error" });
        }
        else if (!toDelete?.events.length) {
            setSelectedTrackIndex(0);
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
        setSelectedTrackIndex(0);
        updateSong({
            ...song,
            tracks: song.tracks.filter(t => t.id !== trackId)
        });
    }

    const setTrackInstrument = (trackId: number, instrumentId: number) => {
        updateSong(changeTrackInstrument(trackId, instrumentId, song));
    }

    const playNote = (note: number) => {
        const track = song.tracks[selectedTrackIndex]!;
        const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

        if (isDrumInstrument(instrument)) {
            const drum = instrument.drums[note];
            pxsim.music.playDrumAsync(drum)
        }
        else {
            pxsim.music.playNoteAsync(note + 1, instrument.instrument, 300)
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
        const track = song.tracks[selectedTrackIndex]!;

        if (track.minOctave === minOctave && track.maxOctave === maxOctave) return;

        if (isDrumInstrument(song.instruments.find(i => i.id === track.instrumentId)!)) {
            return;
        }

        updateTheme({ minOctave, maxOctave });
        updateSong(changeOctaves(track.id, minOctave, maxOctave, song));
    }

    const onVelocityChange = (notes: NoteEvent[]) => {
        updateSong(updateNoteEvents(song, song.tracks[selectedTrackIndex]!.id, notes));
    }

    const onVelocityEditorToggle = () => {
        setVelocityEditorVisible(!velocityEditorVisible);
        fireStateChange({ velocityEditorVisible: !velocityEditorVisible });
    }

    const undo = () => {
        if (!undoStack.length) return;

        const lastState = undoStack.pop()!;
        redoStack.push({ song, selectedTrackIndex });

        setUndoStack([...undoStack]);
        setRedoStack([...redoStack]);

        setSong(lastState.song);
        setSelectedTrackIndex(lastState.selectedTrackIndex);

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
        undoStack.push({ song, selectedTrackIndex });

        setUndoStack([...undoStack]);
        setRedoStack([...redoStack]);

        setSong(nextState.song);
        setSelectedTrackIndex(nextState.selectedTrackIndex);

        fireStateChange({ asset: toPXTSong(nextState.song), undoStack: [...undoStack], redoStack: [...redoStack] });

        if (nextState.song.measures !== song.measures) {
            updateTheme({ measures: nextState.song.measures });
        }

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(nextState.song));
        }
    }

    const onNameChange = (newName: string) => {
        setName(newName);
        fireStateChange({ name: newName });
    }

    const closeModal = () => setModal(null);

    const track = song.tracks[selectedTrackIndex]!;
    const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

    let minOctave: number;
    let maxOctave: number;

    if (fieldEditorParams?.minOctave !== undefined) {
        minOctave = fieldEditorParams.minOctave;
    }
    else {
        minOctave = isDrumInstrument(instrument) ? 0 : track.minOctave;
    }

    if (fieldEditorParams?.maxOctave !== undefined) {
        maxOctave = fieldEditorParams.maxOctave;
    }
    else {
        maxOctave = isDrumInstrument(instrument) ? 1 : track.maxOctave;
    }

    useEffect(() => {
        if (theme.minOctave !== minOctave || theme.maxOctave !== maxOctave || theme.measures !== song.measures) {
            updateTheme({ minOctave, maxOctave, measures: song.measures });
        }
    }, [minOctave, maxOctave, theme.minOctave, theme.maxOctave, updateTheme, song.measures])

    const showHeader = !fieldEditorParams?.hideHeader;

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
            {showHeader &&
                <div className="header-container">
                    <Header
                        song={song}
                        selectedTrackId={track.id}
                        velocityEditorVisible={velocityEditorVisible}
                        onVelocityEditorToggle={onVelocityEditorToggle}
                        onTrackSelected={onTrackSelected}
                        onInstrumentSelected={onInstrumentSelected}
                        onTrackCreated={onTrackCreated}
                        onTrackDeleted={onTrackDeleted}
                        onOctavesChanged={onOctavesChanged}
                    />
                </div>
            }
            <MeasureHeader measures={song.measures} />
            <div className="scroll-container">
                <div className="content-container">
                    <div className="sidebar-container">
                        <Sidebar
                            instrument={instrument}
                            selectedTrackId={track.id}
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
                            bpm={song.tempo}
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
                <div className="spacer" />
                { showEditControls &&
                    <EditControls
                        assetName={name}
                        onAssetNameChanged={onNameChange}
                        hideDoneButton={!onDoneClicked}
                        onDoneClicked={onDoneClicked}
                    />
                }
            </div>
        </div>
    )
}