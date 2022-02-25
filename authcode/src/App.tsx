import React from 'react';
import './App.css';
import { useAppSelector } from './state/store';
import { authorizeToken } from './state/slices/auth';
import * as authClient from './services/auth';
import { useDispatch } from 'react-redux';

function App() {
  const dispatch = useDispatch();
  const { signedIn, profile, tokenStatus } = useAppSelector(state => state.auth);

  let codeRef = React.useRef<HTMLInputElement | null>(null);

  function handleSignOutClick() {
    authClient.logoutAsync('');
  }

  function handleSignInClick() {
    authClient.loginAsync('microsoft', true);
  }

  function handleAuthorizeTokenClick() {
    dispatch(authorizeToken(codeRef.current?.value));
  }

  const firstName = profile?.idp?.displayName?.split(' ')?.[0];

  return (
    <div className="App">
      <div className='app-header'>
        {pxt.appTarget.thumbnailName?.toUpperCase()} - DEVICE AUTH
      </div>
      <div className='app-content'>
        {!signedIn && <p><button onClick={() => handleSignInClick()}>SIGN IN</button></p>}
        {signedIn && (
        <>
        <p>{"Hi " + firstName}! Not you? <button onClick={() => handleSignOutClick()}>SIGN OUT</button></p>
        <div className='enterCode'>Enter the code from your device</div>
        <div className='enterCodeForm'><p><input type='text' maxLength={6} ref={codeRef}/> <button onClick={() => handleAuthorizeTokenClick()}>AUTHORIZE</button></p>
        </div>
        <div className='tokenStatus'>TOKEN STATUS: {tokenStatus}</div>
        </>
        )}
      </div>
    </div>
  );
}

export default App;
