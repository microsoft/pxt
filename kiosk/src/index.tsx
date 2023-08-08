import React from 'react';
import ReactDOM from 'react-dom/client';
import './Kiosk.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { devicePixelRatio, isLocal, tickEvent } from './browserUtils';

interface Map<T> {
  [index: string]: T;
}

function enableAnalytics() {
  const stats: Map<string | number> = {};
  if (typeof window !== "undefined") {
      const screen = window.screen;
      stats["screen.width"] = screen.width;
      stats["screen.height"] = screen.height;
      stats["screen.availwidth"] = screen.availWidth;
      stats["screen.availheight"] = screen.availHeight;
      stats["screen.innerWidth"] = window.innerWidth;
      stats["screen.innerHeight"] = window.innerHeight;
      stats["screen.devicepixelratio"] = devicePixelRatio();
      const body = document.firstElementChild; // body
      if (body) {
          stats["screen.clientWidth"] = body.clientWidth;
          stats["screen.clientHeight"] = body.clientHeight;
      }
  }
  tickEvent("kiosk.loaded", stats);
}

window.addEventListener("DOMContentLoaded", () => {
  enableAnalytics();

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
