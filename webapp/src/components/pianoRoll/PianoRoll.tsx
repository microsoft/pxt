import { PianoRollTheme, PianoRollThemeProvider, usePianoRollThemeContext } from "./context"
import { Workspace } from "./Workspace"
import { Sidebar } from "./Sidebar"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { applyFloatingLayer, changeMeasures, changeOctaves, changeTimeSignature, changeTrackInstrument, deleteFloatingLayer, deleteSelection, fromPXTSong, getEmptySong, isDrumInstrument, moveFloatingLayer, moveSelection, newTrack, NoteEvent, NOTE_RANGES, selectionToFloatingLayer, Song, TIME_SIGNATURES, toPXTSong, Track, transposeFloatingLayer, transposeSelection, updateNoteEvent, updateNoteEvents, updateTrack, WorkspaceSelection } from "./types"
import { Header } from "./Header"
import { DeleteTrackModal } from "./DeleteTrackModal"
import { DeleteErrorModal } from "./DeleteErrorModal"
import { DrumWarningModal } from "./DrumWarningModal"
import { isPlaying, startPlaybackAsync, stopPlayback, updatePlaybackSongAsync } from "../musicEditor/playback"
import { PlaybackControls } from "../musicEditor/PlaybackControls"
import { MeasureHeader } from "./MeasureHeader"
import { VelocityEditor } from "./VelocityEditor"
import { EditControls } from "../musicEditor/EditControls"
import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown"
import { Scrollbar } from "./Scrollbar"
import { classList } from "../../../../react-common/components/util"
import { getCopiedData, setCopiedData } from "./clipboard"
import { xToTick } from "./utils"
import { OctaveWarningModal } from "./OctaveWarningModal"

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

type modalType = "delete-track" | "delete-error" | "drum-warning" | "octave-paste-warning";

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
    showTimeSignature?: boolean;
    showSnapControls?: boolean;
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

    const [snapTicks, setSnapTicks] = useState(4);
    const [velocityEditorVisible, setVelocityEditorVisible] = useState(initialVelocityEditorVisible || false);

    const workspaceContainerRef = useRef<HTMLDivElement>(null);

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
    }, [fieldEditorParams, updateTheme]);

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

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (song.floatingLayer) {
                    updateSong(applyFloatingLayer(song));
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (e.key === "Delete" || e.key === "Backspace") {
                if (song.floatingLayer) {
                    updateSong(deleteFloatingLayer(song));
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                if (song.floatingLayer) {
                    updateSong(transposeFloatingLayer(song, e.key === "ArrowUp" ? 1 : -1));
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                if (song.floatingLayer) {
                    const deltaTicks = e.key === "ArrowLeft" ? -1 : 1;
                    updateSong(moveFloatingLayer(song, deltaTicks));
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }

        const onCopy = (e: ClipboardEvent) => {
            if (song.floatingLayer) {
                const floatingLayer = song.floatingLayer;
                const track = song.tracks.find(t => t.id === song.floatingLayer!.trackId)!;
                setCopiedData({
                    events: floatingLayer.events,
                    startTick: floatingLayer.startTick,
                    endTick: floatingLayer.endTick,
                    isDrumTrack: isDrumInstrument(song.instruments.find(i => i.id === track.instrumentId)!),
                    minOctave: track.minOctave,
                    maxOctave: track.maxOctave
                });
                e.preventDefault();
                e.stopPropagation();
            }
        }

        const onPaste = (e: ClipboardEvent) => {
            const track = song.tracks[selectedTrackIndex]!;
            const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

            const copiedData = getCopiedData(track.instrumentId === undefined ? false : isDrumInstrument(instrument));
            if (!copiedData) return;

            // we want to paste the copied data at the closest measure to where we are scrolled
            // in the workspace
            const workspaceContainer = workspaceContainerRef.current;
            if (!workspaceContainer) return;

            const leftTick = xToTick(theme, workspaceContainer.scrollLeft);
            const ticksPerMeasure = song.beatsPerMeasure * song.ticksPerBeat;
            const measureStart = Math.ceil(leftTick / ticksPerMeasure) * ticksPerMeasure;

            if (!copiedData.isDrumTrack) {
                const copiedMinOctave = Math.floor(copiedData.events.reduce((min, e) => Math.min(min, e.note), Infinity) / 12);
                const copiedMaxOctave = Math.floor(copiedData.events.reduce((max, e) => Math.max(max, e.note), -Infinity) / 12);

                // if the copied data is outside of the current track's octave range, first try to transpose up
                // or down three octaves (the difference between the treble and bass) ranges
                if (copiedMinOctave < track.minOctave) {
                    if (
                        copiedMinOctave + 2 <= track.maxOctave  &&
                        copiedMinOctave + 2 >= track.minOctave &&
                        copiedMaxOctave + 2 <= track.maxOctave
                    ) {
                        for (const event of copiedData.events) {
                            event.note += 24;
                        }
                    }
                    else {
                        setModal({ type: "octave-paste-warning", trackId: track.id });
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
                else if (copiedMaxOctave > track.maxOctave) {
                    if (
                        copiedMaxOctave - 2 >= track.minOctave &&
                        copiedMaxOctave - 2 <= track.maxOctave &&
                        copiedMinOctave - 2 >= track.minOctave
                    ) {
                        for (const event of copiedData.events) {
                            event.note -= 24;
                        }
                    }
                    else {
                        setModal({ type: "octave-paste-warning", trackId: track.id });
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
            }

            const newFloatingLayer: Song["floatingLayer"] = {
                trackId: track.id,
                startTick: measureStart,
                endTick: measureStart + (copiedData.endTick - copiedData.startTick),
                events: copiedData.events.map(e => ({
                    ...e,
                    id: track.nextId++,
                    start: measureStart + (e.start - copiedData.startTick)
                }))
            };

            let newSong = applyFloatingLayer(song);
            newSong.floatingLayer = newFloatingLayer;
            updateSong(newSong);
        }

        window.addEventListener("keydown", onKeydown);
        window.addEventListener("copy", onCopy);
        window.addEventListener("paste", onPaste);
        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("copy", onCopy);
            window.removeEventListener("paste", onPaste);
        };
    }, [updateSong, song, selectedTrackIndex]);

    const onTrackEdit = (updatedTrack: Track) => {
        updateSong(updateTrack(updatedTrack, applyFloatingLayer(song)));
    }

    const onTrackSelected = (trackId: number) => {
        updateSong(applyFloatingLayer(song));
        const index = song.tracks.findIndex(t => t.id === trackId);
        setSelectedTrackIndex(index);
        fireStateChange({ selectedTrackIndex: index });
    }

    const onTrackCreated = () => {
        const newSong = newTrack(song.instruments[0].id, applyFloatingLayer(song));
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
        let newSong = applyFloatingLayer(song);
        updateSong({
            ...newSong,
            tracks: newSong.tracks.filter(t => t.id !== trackId)
        });
    }

    const setTrackInstrument = (trackId: number, instrumentId: number) => {
        let newSong = applyFloatingLayer(song);
        updateSong(changeTrackInstrument(trackId, instrumentId, newSong));
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
        let newSong = applyFloatingLayer(song);
        updateSong(changeMeasures(newMeasures, newSong));

        updateTheme({ measures: newMeasures });
    }

    const onTimeSignatureChanged = (id: string) => {
        const signature = TIME_SIGNATURES.find(ts => ts.id === id);
        if (!signature) return;

        const { beatsPerMeasure, ticksPerBeat } = signature;
        let newSong = applyFloatingLayer(song);
        updateSong(changeTimeSignature(beatsPerMeasure, ticksPerBeat, newSong));

        updateTheme({ beatsPerMeasure, ticksPerBeat });
    }

    const onTempoChange = (newTempo: number) => {
        updateSong({
            ...song,
            tempo: newTempo
        });
    }

    const onOctavesChanged = (minOctave: number, maxOctave: number) => {
        let newSong = applyFloatingLayer(song);
        const track = newSong.tracks[selectedTrackIndex]!;

        if (track.minOctave === minOctave && track.maxOctave === maxOctave) return;

        if (isDrumInstrument(newSong.instruments.find(i => i.id === track.instrumentId)!)) {
            return;
        }

        updateTheme({ minOctave, maxOctave });
        updateSong(changeOctaves(track.id, minOctave, maxOctave, newSong));
    }

    const onVelocityChange = (notes: NoteEvent[]) => {
        let newSong = applyFloatingLayer(song);
        updateSong(updateNoteEvents(newSong, newSong.tracks[selectedTrackIndex]!.id, notes));
    }

    const onVelocityEditorToggle = () => {
        setVelocityEditorVisible(!velocityEditorVisible);
        fireStateChange({ velocityEditorVisible: !velocityEditorVisible });
    }

    const onSelectionChange = useCallback((selection: WorkspaceSelection | undefined) => {
        let newSong = song;
        if (song.floatingLayer) {
            newSong = applyFloatingLayer(song);
        }

        if (!selection) {
            setSong(newSong);
            return;
        }

        const newSelection = { ...selection };

        if (fieldEditorParams?.showSnapControls) {
            newSelection.startTick = Math.floor(selection.startTick / snapTicks) * snapTicks;
            newSelection.endTick = Math.ceil(selection.endTick / snapTicks) * snapTicks;
        }

        setSong(selectionToFloatingLayer(newSong, selectedTrackIndex, newSelection));
    }, [snapTicks, fieldEditorParams?.showSnapControls, song]);

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
        if (lastState.song.beatsPerMeasure !== song.beatsPerMeasure || lastState.song.ticksPerBeat !== song.ticksPerBeat) {
            updateTheme({ beatsPerMeasure: lastState.song.beatsPerMeasure, ticksPerBeat: lastState.song.ticksPerBeat });
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
        if (nextState.song.beatsPerMeasure !== song.beatsPerMeasure || nextState.song.ticksPerBeat !== song.ticksPerBeat) {
            updateTheme({ beatsPerMeasure: nextState.song.beatsPerMeasure, ticksPerBeat: nextState.song.ticksPerBeat });
        }

        if (isPlaying()) {
            updatePlaybackSongAsync(toPXTSong(nextState.song));
        }
    }

    const onNameChange = (newName: string) => {
        setName(newName);
        fireStateChange({ name: newName });
    }

    const onForcePaste = (trackId: number) => {
        const track = song.tracks.find(t => t.id === trackId)!;
        const instrument = song.instruments.find(i => i.id === track.instrumentId)!;

        const copiedData = getCopiedData(isDrumInstrument(instrument));
        if (!copiedData || copiedData.isDrumTrack) return;

        const workspaceContainer = workspaceContainerRef.current;
        if (!workspaceContainer) return;


        const leftTick = xToTick(theme, workspaceContainer.scrollLeft);
        const ticksPerMeasure = song.beatsPerMeasure * song.ticksPerBeat;
        const measureStart = Math.ceil(leftTick / ticksPerMeasure) * ticksPerMeasure;
        const newRange = NOTE_RANGES.find(r => r.id === "full")!;

        const newFloatingLayer: Song["floatingLayer"] = {
            trackId,
            startTick: measureStart,
            endTick: measureStart + (copiedData.endTick - copiedData.startTick),
            events: copiedData.events.map(e => ({
                ...e,
                id: track.nextId++,
                start: measureStart + (e.start - copiedData.startTick)
            }))
        };

        let newSong = applyFloatingLayer(song);
        newSong = changeOctaves(trackId, newRange.minOctave, newRange.maxOctave, newSong);
        newSong.floatingLayer = newFloatingLayer;
        updateSong(newSong);
    }

    const timeSignatures: DropdownItem[] = TIME_SIGNATURES.map(ts => ({
        label: ts.name,
        title: ts.name,
        id: ts.id
    }));
    const selectedTimeSignature = TIME_SIGNATURES.find(ts => ts.beatsPerMeasure === song.beatsPerMeasure && ts.ticksPerBeat === song.ticksPerBeat);

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
        if (
            theme.minOctave !== minOctave ||
            theme.maxOctave !== maxOctave ||
            theme.measures !== song.measures ||
            theme.beatsPerMeasure !== song.beatsPerMeasure ||
            theme.ticksPerBeat !== song.ticksPerBeat
        ) {
            updateTheme({ minOctave, maxOctave, measures: song.measures, beatsPerMeasure: song.beatsPerMeasure, ticksPerBeat: song.ticksPerBeat });
        }
    }, [minOctave, maxOctave, theme.minOctave, theme.maxOctave, updateTheme, song.measures, song.beatsPerMeasure, song.ticksPerBeat])

    const applyFloatingLayerCB = useCallback(() => {
        updateSong(applyFloatingLayer(song));
    }, [song, updateSong]);

    const updateFloatingLayerCB = useCallback((deltaTicks: number, deltaNotes: number) => {
        if (song.floatingLayer) {
            updateSong(moveFloatingLayer(transposeFloatingLayer(song, deltaNotes), deltaTicks));
        }
    }, [song, updateSong]);

    const showHeader = !fieldEditorParams?.hideHeader;

    return (
        <div
            className={classList(
                "piano-roll",
                showHeader ? "show-header" : "hide-header",
                velocityEditorVisible ? "show-velocity-editor" : "hide-velocity-editor"
            )}
        >
            {modal?.type === "delete-track" &&
                <DeleteTrackModal trackId={modal.trackId!} onClose={closeModal} onDelete={deleteTrack} />
            }
            {modal?.type === "delete-error" &&
                <DeleteErrorModal onClose={closeModal} />
            }
            {modal?.type === "drum-warning" &&
                <DrumWarningModal trackId={modal.trackId!} instrumentId={modal.instrumentId!} onClose={closeModal} onConfirm={setTrackInstrument} />
            }
            {modal?.type === "octave-paste-warning" &&
                <OctaveWarningModal trackId={modal.trackId!} onClose={closeModal} onPaste={onForcePaste} />
            }
            {showHeader &&
                <div className="header-container">
                    <Header
                        song={song}
                        selectedTrackId={track.id}
                        velocityEditorVisible={velocityEditorVisible}
                        snapTicks={snapTicks}
                        showSnapControls={fieldEditorParams?.showSnapControls}
                        onVelocityEditorToggle={onVelocityEditorToggle}
                        onTrackSelected={onTrackSelected}
                        onInstrumentSelected={onInstrumentSelected}
                        onTrackCreated={onTrackCreated}
                        onTrackDeleted={onTrackDeleted}
                        onOctavesChanged={onOctavesChanged}
                        onSnapChanged={setSnapTicks}
                    />
                </div>
            }
            <MeasureHeader
                selection={song.floatingLayer}
                onSelectionChange={onSelectionChange}
                snapTicks={fieldEditorParams?.showSnapControls ? snapTicks : 1}
                onKeyDown={() => {}}
            />
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
                    <div ref={workspaceContainerRef} className="workspace-container">
                        <Workspace
                            track={track}
                            onEdit={onTrackEdit}
                            isDrumTrack={isDrumInstrument(instrument)}
                            playNote={playNote}
                            maxTicks={song.measures * song.beatsPerMeasure * song.ticksPerBeat}
                            snapTicks={fieldEditorParams?.showSnapControls ? snapTicks : 1}
                            newNoteDuration={fieldEditorParams?.showSnapControls ? snapTicks : 1}
                            bpm={song.tempo}
                            floatingLayer={song.floatingLayer}
                            updateFloatingLayer={updateFloatingLayerCB}
                            applyFloatingLayer={applyFloatingLayerCB}
                        />
                        <Scrollbar horizontal />
                    </div>
                </div>
                <Scrollbar />
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
                {fieldEditorParams?.showTimeSignature &&
                    <Dropdown
                        id="time-signature-dropdown"
                        items={timeSignatures}
                        selectedId={selectedTimeSignature?.id}
                        onItemSelected={onTimeSignatureChanged}
                    />
                }
                <div className="spacer" />
                {showEditControls &&
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