import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

export default function DebugView() {
    const [godState, setGodState] = useState(null);

    useEffect(() => {
        socket.connect();
        socket.on('god_state', setGodState);
        return () => socket.disconnect();
    }, []);

    const frames = [1, 2, 3, 4, 5, 6, 7, 8];

    return (
        <div style={{ padding: 20 }}>
            <h1 style={{ textAlign: 'center', color: '#8b0000', textShadow: '2px 2px 0px #000' }}>God Mode / Debug View</h1>
            {godState && (
                <div className="god-info">
                    <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                        <div>
                            <strong>Fase:</strong> <code>{godState.phase}</code>
                        </div>
                        <div>
                            <strong>Giorno:</strong> <code>{godState.dayCount || 0}</code>
                        </div>
                        <div>
                            <strong>Voti:</strong> <code>{Object.keys(godState.votes || {}).length}</code>
                        </div>
                        <div>
                            <strong>Azioni Notturne:</strong> <code>{Object.keys(godState.nightActions || {}).length}</code>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                        <details>
                            <summary style={{ cursor: 'pointer' }}>Dettagli JSON (Clicca per espandere)</summary>
                            <pre style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 4, overflowX: 'auto' }}>
                                {JSON.stringify(godState, null, 2)}
                            </pre>
                        </details>
                    </div>
                    <div style={{ marginTop: 15 }}>
                        <button onClick={() => socket.emit('reset')} style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
                            Reset Totale
                        </button>
                    </div>
                </div>
            )}
            <div className="debug-grid">
                {frames.map(i => (
                    <div key={i} className="debug-frame">
                        <iframe src={`${window.location.origin}/`} title={`Player ${i}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
