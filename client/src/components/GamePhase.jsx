import React from 'react';
import { socket } from '../socket';

export default function GamePhase({ state, me }) {
    const { phase, players, logs, winner } = state;

    if (phase === 'LOBBY') {
        return (
            <div className="card">
                <h2>In attesa dei giocatori...</h2>
                <div className="player-list">
                    {players.map(p => (
                        <div key={p.id} className="player-item">
                            {p.name} {p.id === me.id ? '(You)' : ''}
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 20 }}>
                    <p>{players.length} giocatori connessi.</p>
                    {players.length >= 8 ? (
                        <button onClick={() => socket.emit('start_game', { playerCount: players.length })}>
                            Inizia Partita
                        </button>
                    ) : (
                        <p>Servono almeno 8 giocatori per iniziare.</p>
                    )}
                    <button style={{ marginTop: 10, background: '#334155', display: 'block', margin: '10px auto' }} onClick={() => socket.emit('start_game', { playerCount: players.length })}>
                        Avvio Forzato (Dev)
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'END') {
        return (
            <div className="card">
                <h1>Partita Terminata</h1>
                <h2>Vincitori: {winner === 'HUMANS' ? 'UMANI' : 'LUPI MANNARI'}</h2>
                <button onClick={() => socket.emit('reset')}>Gioca Ancora</button>
            </div>
        );
    }

    return (
        <div>
            <div className="phase-indicator">{getPhaseName(phase)}</div>

            <div className="role-card">
                <div className="role-title">{me.role}</div>
                <div>{getRoleDescription(me.role)}</div>
            </div>

            <div className="card">
                <ActionArea state={state} me={me} />
            </div>

            <div className="card" style={{ textAlign: 'left', maxHeight: 200, overflowY: 'auto' }}>
                <h3>Diario di Gioco</h3>
                {logs.map((log, i) => <div key={i} style={{ borderBottom: '1px solid #333', padding: '5px 0' }}>{log}</div>)}
            </div>

            <div className="card">
                <h3>Giocatori</h3>
                <div className="player-list">
                    {state.players.map(p => (
                        <div key={p.id} className={`player-item ${!p.isAlive ? 'dead' : ''}`}>
                            {p.name} {p.role !== 'UNKNOWN' ? `(${p.role})` : ''}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ActionArea({ state, me }) {
    if (state.phase.startsWith('DAY_VOTING')) {
        return (
            <div>
                <h3>Vota per linciare:</h3>
                <div className="player-list">
                    {state.players.filter(p => p.id !== me.id && p.isAlive).map(p => (
                        <button key={p.id} onClick={() => socket.emit('action', { target: p.id })}>
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (!me.isAlive) return <div>Sei morto. Puoi osservare.</div>;

    if (state.phase === 'NIGHT') {
        const canAct = ['WEREWOLF', 'SEER', 'BODYGUARD'].includes(me.role) || (me.role === 'MYTHOMANIAC' && state.dayCount === 1);
        if (canAct) {
            return (
                <div>
                    <h3>Scegli il tuo bersaglio:</h3>
                    <div className="player-list">
                        {state.players.filter(p => p.id !== me.id && p.isAlive).map(p => (
                            <button key={p.id} onClick={() => socket.emit('action', { target: p.id })}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
        return <div>Dormi pure...</div>;
    }

    if (state.phase === 'DAY_DISCUSSION') {
        return (
            <div>
                <p>Discutete su chi è il Lupo Mannaro!</p>
                <button onClick={() => socket.emit('action', { type: 'END_DISCUSSION' })}>
                    Pronto a Votare (Non Implementato)
                </button>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Il Moderatore avvierà la votazione automaticamente.</p>
                {/* For MVP, let's add a button to advance phase for testing */}
                <button onClick={() => socket.emit('action', { type: 'FORCE_VOTE' })} style={{ background: '#334155', marginTop: 10 }}>
                    Inizia Votazione (Dev)
                </button>
            </div>
        );

    }

    return <div>Attendi...</div>;
}

function getRoleDescription(role) {
    switch (role) {
        case 'WEREWOLF': return 'LUPO MANNARO: Uccidi un villico ogni notte. Non farti scoprire!';
        case 'VILLAGER': return 'VILLICO: Trova i lupi e lincialí.';
        case 'SEER': return 'VEGGENTE: Scopri la vera identità di un giocatore ogni notte.';
        case 'BODYGUARD': return 'GUARDIA DEL CORPO: Proteggi un giocatore dai lupi ogni notte.';
        case 'MEDIUM': return 'MEDIUM: Scopri se il giocatore linciato era un Lupo o no.';
        case 'POSSESSED': return 'INDEMONIATO: Sei umano ma vinci se vincono i Lupi.';
        case 'OWL': return 'GUFO: Scegli un giocatore da mandare al linciaggio.';
        case 'MASON': return 'MASSONE: Conosci l\'identità degli altri Massoni.';
        case 'WEREHAMSTER': return 'CRICETO MANNARO: Muori se il Veggente ti vede. Non puoi essere ucciso dai Lupi.';
        case 'MYTHOMANIAC': return 'MITOMANE: Assumi il ruolo del giocatore linciato il primo giorno (o copia un ruolo la prima notte).';
        default: return 'Aiuta la tua squadra a vincere.';
    }
}

function getPhaseName(phase) {
    switch (phase) {
        case 'LOBBY': return 'Lobby';
        case 'NIGHT': return 'Notte';
        case 'DAY_DISCUSSION': return 'Giorno - Discussione';
        case 'DAY_VOTING': return 'Giorno - Votazione';
        case 'END': return 'Fine Partita';
        default: return phase;
    }
}
