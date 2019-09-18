import { createStore } from 'redux';

import reducer from './imageReducer';

const store = createStore(reducer);
export default store;