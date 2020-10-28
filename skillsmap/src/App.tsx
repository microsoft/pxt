import React from 'react';
import { Provider } from 'react-redux';

import store from './store/store'
import { Activity } from './store/reducer';
import { SkillsCarousel } from './components/SkillsCarousel'
import { Carousel } from './components/Carousel'

import './App.css';

function App() {
    const temp: Activity[] = [
        {
            id: "step-1",
            name: "1. Happy Flower",
            description: "Get started creating a simple game to chase a pizza around the screen and collect as many points as possible before time runs out!",
            tags: ["easy", "botanical"],
            next: "step-2",
            url: "/tutorials/happy-flower",
            imageUrl: "/static/tutorials/happy-flower.png"
        },
        {
            id: "step-4",
            name: "4. Lemon Leak",
            description: "Jump and run to avoid the barrels",
            tags: ["medium"],
            next: "step-5",
            url: "/tutorials/happy-flower",
            imageUrl: "/static/tutorials/barrel-dodger.png"
        },
        {
            id: "step-2",
            name: "2. Free Throw",
            description: "Take your best shot and slam dunk this Basketball free throw game!",
            tags: ["easy"],
            next: "step-3",
            url: "/tutorials/free-throw",
            imageUrl: "/static/tutorials/free-throw.png"
        },
        {
            id: "step-5",
            name: "5. Hero Walk",
            description: "Jump and run to avoid the barrels",
            tags: ["medium"],
            url: "/tutorials/happy-flower",
            imageUrl: "/static/tutorials/barrel-dodger.png"
        },
        {
            id: "step-3",
            name: "3. Barrel Dodger",
            description: "Jump and run to avoid the barrels",
            tags: ["medium"],
            next: "step-4",
            url: "/tutorials/happy-flower",
            imageUrl: "/static/tutorials/barrel-dodger.png"
        },];

    return (<Provider store={store}>
            <div className="skills-map-container">
                <SkillsCarousel activities={temp} />
                <Carousel items={[{id: "test", label: "test-one"},{id: "test2", label: "test-two"},{id: "test3", label: "test-three"}]} />
            </div>
        </Provider>);
}

export default App;
