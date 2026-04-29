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

    const resultRef = useRef<PianoRollState>();

    useEffect(() => {
        if (handleRef) {
            let asset: pxt.Song | undefined;
            handleRef({
                init: (value: pxt.Song, close: () => void) => {
                    asset = value;
                    setAsset(value);
                },
                getValue: () => ({
                    ...asset,
                    song: resultRef.current.asset
                }),
                getPersistentData: () => {
                    return {
                        undoStack: resultRef.current?.undoStack,
                        redoStack: resultRef.current?.redoStack
                    }
                },
                restorePersistentData: (value: any) => {
                    if (value) {
                        setUndoStack(value.undoStack || []);
                        setRedoStack(value.redoStack || []);
                    }
                }
            })
        }
    }, [handleRef])

    const onStateChange = useCallback((state: PianoRollState) => {
        resultRef.current = state;
    }, [])

    return (
        <PianoRoll
            asset={asset?.song}
            undoStack={undoStack}
            redoStack={redoStack}
            onStateChanged={onStateChange}
        />
    )
}