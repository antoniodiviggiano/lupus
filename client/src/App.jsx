import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import GamePhase from './components/GamePhase';
import DebugView from './components/DebugView';
import './index.css';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.connect();

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onStateUpdate(value) {
      setGameState(value);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state_update', onStateUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state_update', onStateUpdate);
      socket.disconnect();
    };
  }, []);

  const handleJoin = (name) => {
    setPlayerName(name);
    socket.emit('join', name);
    setJoined(true);
  };

  const isDebug = new URLSearchParams(window.location.search).get('debug');
  if (isDebug) {
    return <DebugView />;
  }

  if (!isConnected) return <div className="loading">Connecting to server...</div>;

  if (!joined) {
    return <Lobby onJoin={handleJoin} />;
  }

  return (
    <div className="app-container">
      {gameState && <GamePhase state={gameState} me={gameState.me} />}
    </div>
  );
}

export default App;
