import { createStore } from 'redux';

import topReducer from './reducer';

const store = createStore(topReducer);
export default store;