import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldEditorComponent } from "../../blocklyFieldView"
import { FieldEditorParams, PianoRoll, PianoRollModel } from "./PianoRoll"
import { fromPXTSong, toPXTSong } from "./types";

interface Props {
    handleRef: (e: FieldEditorComponent<any>) => void;
    fieldEditorParams?: FieldEditorParams;
}

interface DoneCallback {
    onDoneClicked: () => void;
}

export const PianoRollFieldEditor = (props: Props) => {
    const { handleRef, fieldEditorParams } = props;

    const model = useMemo(() => new PianoRollModel(), []);
    const [initValue, setInitValue] = useState<pxt.Song>();
    const [onDoneClicked, setOnDoneClicked] = useState<DoneCallback>(undefined);

    useEffect(() => {
        if (handleRef) {
            let openedAsset = initValue;
            handleRef({
                init: (value: pxt.Song, close: () => void) => {
                    openedAsset = value;

                    const songValue = fromPXTSong(value.song);
                    const name = value.meta?.displayName;

                    model.updateValue({
                        song: songValue,
                        assetName: name,
                        selectedTrackIndex: 0
                    }, { preserveUndo: false });
                    setInitValue(value);
                    setOnDoneClicked({ onDoneClicked: close });
                },
                getValue: () => {
                    if (!model) return openedAsset;
                    const currentValue = model.getCurrentValue();
                    const pxtSong = toPXTSong(currentValue.song);

                    const result: pxt.Song = {
                        ...openedAsset,
                        song: pxtSong
                    };

                    if (openedAsset?.meta || currentValue.assetName) {
                        result.meta = {
                            ...(openedAsset?.meta || {}),
                            displayName: currentValue.assetName
                        }
                    }

                    return result;
                },
                getPersistentData: () => {
                    return model?.getState();
                },
                restorePersistentData: (value: any) => {
                    if (value && model) {
                        model.restoreState(value);
                    }
                }
            })
        }
    }, [handleRef, model, initValue])

    return (
        <PianoRoll
            model={model}
            showEditControls={true}
            onDoneClicked={onDoneClicked?.onDoneClicked}
            fieldEditorParams={fieldEditorParams}
        />
    )
}