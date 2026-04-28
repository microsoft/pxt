import { useCallback, useEffect, useRef, useState } from "react";
import { FieldEditorComponent } from "../../blocklyFieldView"
import { PianoRoll, PianoRollState } from "./PianoRoll"

interface Props {
    handleRef: (e: FieldEditorComponent<any>) => void;
}

export const PianoRollFieldEditor = (props: Props) => {
    const { handleRef } = props;

    const [asset, setAsset] = useState<pxt.Song>();
    const [undoStack, setUndoStack] = useState<PianoRollState["undoStack"]>([]);
    const [redoStack, setRedoStack] = useState<PianoRollState["redoStack"]>([]);
    const [velocityEditorVisible, setVelocityEditorVisible] = useState<PianoRollState["velocityEditorVisible"]>(undefined);
    const [selectedTrack, setSelectedTrack] = useState<PianoRollState["selectedTrack"]>(undefined);

    const resultRef = useRef<PianoRollState>();

    useEffect(() => {
        if (handleRef) {
            handleRef({
                init: (value: pxt.Song, close: () => void) => {
                    setAsset(value);
                },
                getValue: () => ({
                    ...asset,
                    song: resultRef.current.asset
                }),
                getPersistentData: () => {
                    return {
                        undoStack: resultRef.current?.undoStack,
                        redoStack: resultRef.current?.redoStack,
                        velocityEditorVisible: resultRef.current?.velocityEditorVisible,
                        selectedTrack: resultRef.current?.selectedTrack
                    }
                },
                restorePersistentData: (value: any) => {
                    if (value) {
                        setUndoStack(value.undoStack || []);
                        setRedoStack(value.redoStack || []);
                        setVelocityEditorVisible(value.velocityEditorVisible);
                        setSelectedTrack(value.selectedTrack);
                    }
                }
            })
        }
    }, [handleRef, asset])

    const onStateChange = useCallback((state: PianoRollState) => {
        resultRef.current = state;
    }, [])

    return (
        <PianoRoll
            asset={asset?.song}
            undoStack={undoStack}
            redoStack={redoStack}
            onStateChanged={onStateChange}
            selectedTrack={selectedTrack}
            velocityEditorVisible={velocityEditorVisible}
        />
    )
}