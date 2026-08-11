import * as React from "react";

interface UpdateOptions {
    preserveUndo?: boolean;
    pushUndo?: boolean;
}

export abstract class AssetModel<T> {
    protected currentValue: T;
    protected undoStack: T[] = [];
    protected redoStack: T[] = [];

    protected abstract cloneValue(value: T): T;

    protected listeners: (() => void)[] = [];

    constructor(initialValue?: T) {
        if (initialValue !== undefined) {
            this.currentValue = this.cloneValue(initialValue);
        }
    }

    public addChangeListener(listener: () => void) {
        this.listeners.push(listener);
    }

    public removeChangeListener(listener: () => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    protected notifyChange() {
        this.listeners.forEach(l => l());
    }

    public updateValue(newValue: T, options: UpdateOptions = {}) {
        const { preserveUndo = true, pushUndo = true } = options;
        if (preserveUndo) {
            if (pushUndo && this.currentValue !== undefined) {
                this.undoStack.push(this.currentValue);
            }
        }
        else {
            this.undoStack = [];
        }

        this.redoStack = [];
        this.currentValue = this.cloneValue(newValue);
        this.notifyChange();
    }

    public undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(this.currentValue);
            this.currentValue = this.undoStack.pop()!;
            this.notifyChange();
        }
    }

    public redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(this.currentValue);
            this.currentValue = this.redoStack.pop()!;
            this.notifyChange();
        }
    }

    public getCurrentValue(): T {
        return this.cloneValue(this.currentValue);
    }

    public getState(): { currentValue: T; undoStack: T[]; redoStack: T[] } {
        return {
            currentValue: this.cloneValue(this.currentValue),
            undoStack: this.undoStack.map(v => this.cloneValue(v)),
            redoStack: this.redoStack.map(v => this.cloneValue(v))
        };
    }

    public restoreState(state: { currentValue: T; undoStack: T[]; redoStack: T[] }) {
        this.currentValue = this.cloneValue(state.currentValue);
        this.undoStack = state.undoStack.map(v => this.cloneValue(v));
        this.redoStack = state.redoStack.map(v => this.cloneValue(v));
        this.notifyChange();
    }

    public hasUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public hasRedo(): boolean {
        return this.redoStack.length > 0;
    }
}

export class SongModel extends AssetModel<pxt.Song> {
    protected cloneValue(value: pxt.Song): pxt.Song {
        return pxt.cloneAsset(value);
    }
}

export const useSongModel = (initialValue: pxt.Song) => {
    const [model] = React.useState(() => new SongModel());
    const [editRef, setEditRef] = React.useState(0);

    React.useEffect(() => {
        const handleChange = () => {
            setEditRef(ref => ref + 1);
        };
        model.addChangeListener(handleChange);
        return () => {
            model.removeChangeListener(handleChange);
        };
    }, []);

    React.useEffect(() => {
        model.updateValue(initialValue, { preserveUndo: false });
    }, [initialValue]);

    return model;
}

export const useModelValue = <T,>(model: AssetModel<T>) => {
    const [value, setValue] = React.useState(model.getCurrentValue());

    React.useEffect(() => {
        const handleChange = () => {
            setValue(model.getCurrentValue());
        };
        model.addChangeListener(handleChange);
        return () => {
            model.removeChangeListener(handleChange);
        };
    }, [model]);

    return { value, hasUndo: model.hasUndo(), hasRedo: model.hasRedo() };
}