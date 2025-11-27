import React, { useState } from 'react';

export default function Lobby({ onJoin }) {
    const [name, setName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin(name);
        }
    };

    return (
        <div className="app-container">
            <div className="card">
                <h1>Lupus in Tabula</h1>
                <p>Inserisci il tuo nome per unirti al villaggio.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Il tuo nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={12}
                    />
                    <button type="submit">Entra in Partita</button>
                </form>
            </div>
        </div>
    );
}
