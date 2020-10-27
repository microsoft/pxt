import React from 'react';
import { Provider } from 'react-redux';

import store from './store/store'
import { Item } from './components/Item'

import './App.css';

function App() {
    const steps = [
        { id: "step-1" },
        { id: "step-2" },
        { id: "step-3" },
        { id: "step-4" }];

    return (<Provider store={store}>
            <div className="skills-map-container">
                <div className="skills-map-steps">
                    {steps.map(((step, i) => {
                        return <Item id={step.id} key={i} />
                    }))}
                </div>
            </div>
        </Provider>);
}

export default App;
