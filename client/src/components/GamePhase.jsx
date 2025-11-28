import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

// Role Translations
const ROLE_NAMES = {
    'WEREWOLF': 'Lupo Mannaro',
    'VILLAGER': 'Villico',
    'SEER': 'Veggente',
    'BODYGUARD': 'Guardia del Corpo',
    'MEDIUM': 'Medium',
    'POSSESSED': 'Indemoniato',
    'OWL': 'Gufo',
    'MASON': 'Massone',
    'WEREHAMSTER': 'Criceto Mannaro',
    'MYTHOMANIAC': 'Mitomane',
    'SPECTATOR': 'Spettatore',
    'UNKNOWN': 'Sconosciuto'
};

export default function GamePhase({ state, me }) {
    const { phase, players, logs, winner } = state;

    if (phase === 'LOBBY') {
        return (
            <div className="card">
                <h2>In attesa dei giocatori...</h2>
                <div className="player-list">
                    {players.map(p => (
                        <div key={p.id} className="player-item">
                            {p.name} {p.id === me?.id ? '(Tu)' : ''}
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

    const isNight = phase === 'NIGHT';
    const canWake = ['WEREWOLF', 'SEER', 'BODYGUARD'].includes(me.role) || (me.role === 'MYTHOMANIAC' && state.dayCount === 1);
    const showNightOverlay = isNight && !canWake;

    return (
        <div>
            {/* Header */}
            <div className="game-header">
                <div className="player-name-display">{me.name}</div>
                <div style={{ color: '#d7c49e' }}>{getPhaseName(phase)}</div>
            </div>

            {showNightOverlay && (
                <div className="night-overlay">
                    <h2>È Notte...</h2>
                    <p>Il villaggio dorme.</p>
                </div>
            )}

            <div className="role-card">
                <div className="role-title">{ROLE_NAMES[me.role] || me.role}</div>
                <div>{getRoleDescription(me.role)}</div>
            </div>

            <div className="card">
                <ActionArea state={state} me={me} />
            </div>

            <div className="card" style={{ textAlign: 'left', maxHeight: 200, overflowY: 'auto' }}>
                <h3>Diario di Gioco</h3>
                {logs.map((log, i) => <div key={i} style={{ borderBottom: '1px solid #5d4037', padding: '5px 0', color: '#3e2723' }}>{log}</div>)}
            </div>

            <div className="card">
                <h3>Giocatori</h3>
                <div className="player-list">
                    {state.players.map(p => (
                        <div key={p.id} className={`player - item ${!p.isAlive ? 'dead' : ''} `}>
                            {p.name}
                            {p.role !== 'UNKNOWN' ? <div className="role-badge">{ROLE_NAMES[p.role]}</div> : ''}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ActionArea({ state, me }) {
    // Local state for countdown
    const [pendingTarget, setPendingTarget] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef(null);

    // Use server-side state for FINAL selection if available
    const confirmedId = me.myAction;

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && pendingTarget) {
            // Time is up, confirm vote!
            socket.emit('action', { target: pendingTarget });
            setPendingTarget(null);
        }
    }, [timeLeft, pendingTarget]);

    const handleAction = (targetId) => {
        // If already confirmed, maybe allow changing? Yes, restart process.
        if (targetId === pendingTarget) return; // Already pending this one

        // Start countdown
        setPendingTarget(targetId);
        setTimeLeft(5);
    };

    const cancelVote = () => {
        setPendingTarget(null);
        setTimeLeft(0);
    };

    if (state.phase.startsWith('DAY_VOTING')) {
        return (
            <div>
                <h3>Vota per linciare:</h3>
                <div className="player-list">
                    {state.players.filter(p => p.isAlive && p.id !== me.id).map(p => {
                        const isPending = pendingTarget === p.id;
                        const isConfirmed = confirmedId === p.id;
                        return (
                            <button
                                key={p.id}
                                className={`player-item selection-button ${isPending || isConfirmed ? 'selected' : ''}`}
                                onClick={() => handleAction(p.id)}
                                disabled={!!confirmedId} // Lock vote after confirmation
                                style={isConfirmed ? { opacity: 1, borderColor: '#8b0000' } : (confirmedId ? { opacity: 0.5, cursor: 'not-allowed' } : {})}
                            >
                                {p.name}
                                {isPending && (
                                    <>
                                        <div className="vote-countdown">Conferma in {timeLeft}...</div>
                                        <div className="confirm-progress"></div>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
                {pendingTarget && (
                    <div style={{ marginTop: 10 }}>
                        <button onClick={cancelVote} style={{ background: '#333', fontSize: '0.8rem', padding: '5px 10px' }}>
                            Annulla Selezione
                        </button>
                    </div>
                )}
                {confirmedId && !pendingTarget && <p style={{ color: '#cd853f', marginTop: 10 }}>Voto confermato.</p>}
            </div>
        );
    }

    if (!me.isAlive) {
        return (
            <div className="dead-view">
                <div className="dead-text">Sei Morto</div>
                <p>La tua voce non può più essere udita dai vivi.</p>
                <p>Osserva nell'ombra...</p>
            </div>
        );
    }

    if (state.phase === 'NIGHT') {
        const canAct = ['WEREWOLF', 'SEER', 'BODYGUARD'].includes(me.role) || (me.role === 'MYTHOMANIAC' && state.dayCount === 1);
        if (canAct) {
            return (
                <div>
                    <h3>Scegli il tuo bersaglio:</h3>
                    <div className="player-list">
                        {state.players.filter(p => {
                            if (!p.isAlive) return false;
                            // Prevent Wolf vs Wolf friendly fire
                            if (me.role === 'WEREWOLF' && p.role === 'WEREWOLF') return false;
                            return true;
                        }).map(p => {
                            const isPending = pendingTarget === p.id;
                            const isConfirmed = confirmedId === p.id;
                            return (
                                <button
                                    key={p.id}
                                    className={`player-item selection-button ${isPending || isConfirmed ? 'selected' : ''}`}
                                    onClick={() => handleAction(p.id)}
                                    disabled={!!confirmedId} // Lock vote after confirmation
                                    style={isConfirmed ? { opacity: 1, borderColor: '#8b0000' } : (confirmedId ? { opacity: 0.5, cursor: 'not-allowed' } : {})}
                                >
                                    {p.name}
                                    {isPending && (
                                        <>
                                            <div className="vote-countdown">Conferma in {timeLeft}...</div>
                                            <div className="confirm-progress"></div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {pendingTarget && (
                        <div style={{ marginTop: 10 }}>
                            <button onClick={cancelVote} style={{ background: '#333', fontSize: '0.8rem', padding: '5px 10px' }}>
                                Annulla Selezione
                            </button>
                        </div>
                    )}
                    {confirmedId && !pendingTarget && <p style={{ color: '#cd853f', marginTop: 10 }}>Scelta confermata.</p>}
                </div>
            );
        }
        return <div>Dormi pure...</div>;
    }

    if (state.phase === 'DAY_DISCUSSION') {
        return (
            <div>
                <p>Discutete su chi è il Lupo Mannaro!</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={() => socket.emit('action', { type: 'FORCE_VOTE' })} style={{ background: '#8b0000' }}>
                        INIZIA VOTAZIONE
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 10 }}>
                    (Clicca per passare alla fase di voto)
                </p>
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
        case 'SPECTATOR': return 'SPETTATORE: Osserva la partita in corso. Sei un fantasma silenzioso.';
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
