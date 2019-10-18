import { createStore } from 'redux';

import topReducer from './imageReducer';

const store = createStore(topReducer);
export default store;