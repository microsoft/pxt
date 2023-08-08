import React, { useEffect, useState } from 'react';
import './Kiosk.css';
import './Fonts.css';
import { Kiosk } from './Models/Kiosk';
import MainMenu from './Components/MainMenu';
import { KioskState } from './Models/KioskState';
import EnterHighScore from './Components/EnterHighScore';
import AddingGame from './Components/AddingGame';
import ScanQR from './Components/ScanQR';
import QrSuccess from './Components/QrSuccess';
import GameOver from './Components/GameOver';

const url = window.location.href;
const clean = !!/clean(?:[:=])1/.test(url);
const locked = !!/lock(?:[:=])1/i.test(url);
const time = (/time=((?:[0-9]{1,3}))/i.exec(url))?.[1];

const kioskSingleton: Kiosk = new Kiosk(clean, locked, time);
kioskSingleton.initialize().catch(error => alert(error));

function App() {
  const[state, setState] = useState(kioskSingleton.state);

  useEffect(() => {
    window.onhashchange = onHashChange;

    kioskSingleton.onNavigated = () => {
      setState(kioskSingleton.state);
    };
    onHashChange();
  }, []);

  switch(state) {
      case KioskState.MainMenu:
        return (<MainMenu kiosk={kioskSingleton} />)
      case KioskState.EnterHighScore:
        return (<EnterHighScore kiosk={kioskSingleton} />)
      case KioskState.AddingGame:
        return (<AddingGame kiosk={kioskSingleton} />)
      case KioskState.ScanQR:
        return (<ScanQR kiosk={kioskSingleton} />)
      case KioskState.QrSuccess:
        return (<QrSuccess />)
      case KioskState.GameOver:
        return (<GameOver kiosk={kioskSingleton}/>)
    }

  return (<div />)
}

function onHashChange() {
  const hash = window.location.hash;
  const match = /pub:((?:\d{5}-\d{5}-\d{5}-\d{5})|(?:_[a-zA-Z0-9]+))/.exec(hash);
  const addGame = /add-game:((?:[a-zA-Z0-9]{6}))/.exec(hash);
  if (match) {
    kioskSingleton.launchGame(match[1], true);
  } else if (addGame) {
    kioskSingleton.navigate(KioskState.ScanQR);
  }
}

export default App;