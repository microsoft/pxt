import { DataSubscriber, invalidate, mountVirtualApi, subscribe, unsubscribe } from "../data";

interface Store extends Object {
    $id: string;
}

export interface ActionBase {
    type: string;
}

interface StoreAndReducer<T extends Store, U extends ActionBase> {
    store: T;
    reducer: Reducer<T, U>;
}

export type Reducer<T extends Object, U extends ActionBase> = (store: T, action: U) => T;
export type ChangeListener<T extends Object, U extends keyof T> = (store: T, field?: U) => void;
export type Dispatch<U extends ActionBase> = (action: U) => void;


let storeStore: Map<string, StoreAndReducer<any, any>> = new Map();

export function createStore<T extends Object, U extends ActionBase>(store: T, reducer: Reducer<T, U>): [() => T & Store, Dispatch<U>] {
    const id = pxt.Util.guidGen();
    storeStore.set(id, {
        store: {
            ...store,
            $id: id
        },
        reducer
    });

    mountVirtualApi(id, {
        getSync: (path: string) => {
            const store = getStore(id);

            const parts = path.split(":");

            if (parts[1] && parts[1] !== "*" && parts[1] !== "any") {
                return store[parts[1]];
            }

            return store;
        }
    });

    return [
        () => getStore(id),
        (action: U) => dispatchOnStore(id, action)
    ];
}

function getStore(id: string) {
    return storeStore.get(id).store;
}


function dispatchOnStore<U extends ActionBase>(id: string, action: U) {
    const { store, reducer } = storeStore.get(id);

    const newValue = reducer(store, action);

    storeStore.set(id, {
        store: newValue,
        reducer
    });

    const changes: string[] = [];

    const oldKeys = Object.keys(store);
    const newKeys = Object.keys(newValue);

    for (const key of oldKeys) {
        if (newKeys.indexOf(key) === -1) {
            changes.push(getSubscribePath(store, key));
        }
    }

    for (const key of Object.keys(newValue)) {
        if (oldKeys.indexOf(key) === -1) {
            changes.push(getSubscribePath(store, key));
        }
        else if (store[key] !== newValue[key]) {
            const oldEntry = store[key];
            const newEntry = newValue[key];
            const oldType = typeof oldEntry;
            const newType = typeof newEntry;

            if (oldType !== newType || oldType !== "object") {
                changes.push(getSubscribePath(store, key));
                continue;
            }

            const oldIsArray = Array.isArray(oldEntry);
            const newIsArray = Array.isArray(newEntry);
            if (oldIsArray !== newIsArray) {
                changes.push(getSubscribePath(store, key));
                continue;
            }

            if (oldIsArray) {
                if (!shallowArrayEquals(oldEntry, newEntry)) {
                    changes.push(getSubscribePath(store, key));
                }
            }
            else if (!shallowObjectEquals(oldEntry, newEntry)) {
                changes.push(getSubscribePath(store, key));
            }
        }
    }

    for (const change of changes) {
        invalidate(change);
    }

    // make sure we always notify anyone who subscribed to "*"
    if (changes.length === 0) {
        invalidate(`${store.$id}:any`);
    }
}

function shallowArrayEquals(a: any[], b: any[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        const aValue = a[i];
        const bValue = b[i];

        if (aValue !== bValue) {
            return false;
        }
    }

    return true;
}

function shallowObjectEquals(a: any, b: any) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) {
        return false;
    }

    for (const key of aKeys) {
        if (a[key] !== b[key]) {
            return false;
        }
    }

    return true;
}


export function subscribeToStore<T extends Store, U extends keyof T>(store: T, onChange: ChangeListener<T, U>, field?: U): () => void {
    let timeoutHandle: any;

    const subscriber: DataSubscriber = {
        subscriptions: [],
        onDataChanged: () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }

            timeoutHandle = setTimeout(() => {
                onChange(getStore(store.$id), field);
            });
        }
    };

    subscribe(subscriber, getSubscribePath(store, field));

    return () => unsubscribe(subscriber);
}


export function getSubscribePath<T extends Store, U extends keyof T>(store: T, field?: U): string {
    let result = store.$id;

    if (field) {
        result += ":" + (field as string);
    }
    else {
        result += ":*"
    }

    return result;
}