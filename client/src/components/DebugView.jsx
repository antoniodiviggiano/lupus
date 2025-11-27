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
        <div>
            <h1 style={{ textAlign: 'center' }}>God Mode / Debug View</h1>
            {godState && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    Phase: {godState.phase} |
                    Votes: {JSON.stringify(godState.votes)} |
                    Night Actions: {JSON.stringify(godState.nightActions)}
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
