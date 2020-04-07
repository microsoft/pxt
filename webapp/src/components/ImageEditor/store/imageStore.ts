import { createStore } from 'redux';

import topReducer from './imageReducer';

const store = createStore(topReducer);
export default store;

export const tileEditorStore = createStore(topReducer);
export const mainStore = store;