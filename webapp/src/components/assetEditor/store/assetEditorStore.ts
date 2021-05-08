import { createStore } from 'redux';

import topReducer from './assetEditorReducer';

const store = createStore(topReducer);
export default store;