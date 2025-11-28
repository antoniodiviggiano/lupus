export class Game {
    constructor(io) {
        this.io = io;
        this.reset();
    }

    reset() {
        this.players = {};
        this.phase = 'LOBBY'; // LOBBY, NIGHT, DAY_DISCUSSION, DAY_NOMINATION, DAY_DEFENSE, DAY_LYNCHING, END
        this.subPhase = '';
        this.settings = { playerCount: 8 };
        this.nightActions = {};
        this.votes = {};
        this.dayCount = 0;
        this.logs = [];
        this.nominees = []; // For Day phases
        this.broadcastState();
    }

    addPlayer(socketId, name) {
        // Generate random Italian name if none provided
        const italianNames = [
            'Mario', 'Luigi', 'Giovanni', 'Francesco', 'Antonio', 'Giuseppe',
            'Roberto', 'Paolo', 'Stefano', 'Marco', 'Alessandro', 'Lorenzo',
            'Leonardo', 'Mattia', 'Andrea', 'Maria', 'Anna', 'Sofia',
            'Giulia', 'Martina', 'Chiara', 'Sara', 'Francesca', 'Elena',
            'Silvia', 'Alice', 'Giorgia', 'Valentina', 'Laura', 'Aurora',
            'Dante', 'Beatrice', 'Cesare', 'Lucrezia', 'Niccolò', 'Caterina'
        ];
        const randomName = italianNames[Math.floor(Math.random() * italianNames.length)] + ' ' + (Math.floor(Math.random() * 100));
        const finalName = name || randomName;

        if (this.phase !== 'LOBBY') {
            // Join as Spectator
            this.players[socketId] = {
                id: socketId,
                name: finalName + ' (Spettatore)',
                role: 'SPECTATOR',
                isAlive: false,
                isGhost: true,
                isConnected: true
            };
            this.broadcastState();
            return;
        }

        this.players[socketId] = {
            id: socketId,
            name: finalName,
            role: null,
            isAlive: true,
            isGhost: false,
            isConnected: true
        };
        this.broadcastState();
    }

    removePlayer(socketId) {
        if (this.players[socketId]) {
            this.players[socketId].isConnected = false;
            if (this.phase === 'LOBBY') {
                delete this.players[socketId];
            }
            this.broadcastState();
        }
    }

    startGame(settings) {
        const playerIds = Object.keys(this.players);
        // Official rules say min 8, but we allow dev testing
        this.settings = settings;
        this.assignRoles(playerIds.length);
        this.startNight();
    }

    assignRoles(count) {
        // Base: 2 Wolves, 1 Seer
        let roles = ['WEREWOLF', 'WEREWOLF', 'SEER'];

        if (count >= 9) roles.push('MEDIUM');
        if (count >= 10) roles.push('POSSESSED');
        if (count >= 11) roles.push('BODYGUARD');
        if (count >= 12) roles.push('OWL');
        if (count >= 13) roles.push('MASON', 'MASON');
        if (count >= 15) roles.push('WEREHAMSTER');
        if (count >= 16) {
            roles.push('MYTHOMANIAC');
            roles.push('WEREWOLF'); // 3rd Wolf
        }

        // Fill rest with Villagers
        while (roles.length < count) {
            roles.push('VILLAGER');
        }

        // Shuffle
        roles = roles.sort(() => Math.random() - 0.5);

        const playerIds = Object.keys(this.players);
        playerIds.forEach((id, index) => {
            this.players[id].role = roles[index];
        });
    }

    startNight() {
        this.phase = 'NIGHT';
        this.dayCount++;
        this.nightActions = {};
        this.logs.push(`--- Notte ${this.dayCount} ---`);

        // Medium Logic (Start of Night 2+)
        if (this.dayCount > 1) {
            const medium = Object.values(this.players).find(p => p.role === 'MEDIUM' && p.isAlive);
            if (medium && this.lastLynchedRole) {
                const isWolf = this.lastLynchedRole === 'WEREWOLF';
                this.io.to(medium.id).emit('private_message', `Il giocatore linciato ERA ${isWolf ? 'un Lupo Mannaro' : 'un Umano'}.`);
            }
        }

        this.broadcastState();
    }

    startDay() {
        this.phase = 'DAY_DISCUSSION';
        this.votes = {};
        this.nominees = [];

        let victims = [];
        let protectedPlayer = null;

        // 1. Bodyguard
        const bgAction = Object.values(this.nightActions).find(a => a.role === 'BODYGUARD');
        if (bgAction) {
            protectedPlayer = bgAction.target;
            this.logs.push("La Guardia del Corpo ha protetto qualcuno.");
        }

        // 2. Mythomaniac (Night 2 only)
        if (this.dayCount === 2) {
            const mythAction = Object.values(this.nightActions).find(a => a.role === 'MYTHOMANIAC');
            if (mythAction) {
                const target = this.players[mythAction.target];
                const mythId = Object.keys(this.nightActions).find(id => this.nightActions[id] === mythAction);
                if (target && mythId) {
                    if (target.role === 'WEREWOLF' || target.role === 'SEER') {
                        this.players[mythId].role = target.role;
                        this.io.to(mythId).emit('private_message', `Hai copiato il ruolo: ${target.role}!`);
                    } else {
                        this.io.to(mythId).emit('private_message', `Il bersaglio non era speciale. Rimani Umano.`);
                    }
                }
            }
        }

        // 3. Seer (Handle Werehamster death)
        const seerAction = Object.values(this.nightActions).find(a => a.role === 'SEER');
        if (seerAction) {
            const target = this.players[seerAction.target];
            if (target && target.role === 'WEREHAMSTER') {
                victims.push(target.id);
                this.logs.push("Il Criceto Mannaro è morto di paura!");
            }
        }

        // 4. Werewolves
        const wolfVotes = Object.values(this.nightActions).filter(a => a.role === 'WEREWOLF').map(a => a.target);
        if (wolfVotes.length > 0) {
            const counts = {};
            wolfVotes.forEach(v => counts[v] = (counts[v] || 0) + 1);
            // Simple majority
            const targetId = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

            const target = this.players[targetId];
            if (target) {
                if (targetId === protectedPlayer) {
                    this.logs.push("I Lupi hanno attaccato, ma la vittima era protetta!");
                } else if (target.role === 'WEREHAMSTER') {
                    this.logs.push("I Lupi hanno attaccato, ma la vittima non è morta!");
                } else {
                    victims.push(targetId);
                }
            }
        }

        // Apply deaths
        victims.forEach(vid => {
            if (this.players[vid] && this.players[vid].isAlive) {
                this.players[vid].isAlive = false;
                this.players[vid].isGhost = true;
                this.logs.push(`${this.players[vid].name} è stato sbranato.`);
            }
        });

        this.checkWinCondition();
        this.broadcastState();
    }

    handleAction(socketId, data) {
        const player = this.players[socketId];
        if (!player) return;

        // Night Actions
        if (this.phase === 'NIGHT' && player.isAlive) {
            // Check if role can act
            let canAct = ['WEREWOLF', 'SEER', 'BODYGUARD', 'OWL'].includes(player.role);
            if (player.role === 'MYTHOMANIAC' && this.dayCount === 2) canAct = true;

            if (canAct) {
                this.nightActions[socketId] = { role: player.role, target: data.target };

                // Immediate feedback for Seer
                if (player.role === 'SEER') {
                    const target = this.players[data.target];
                    const isWolf = target.role === 'WEREWOLF' || (target.role === 'MYTHOMANIAC' && this.dayCount > 2 && target.role === 'WEREWOLF'); // Mythomaniac check simplified
                    this.io.to(socketId).emit('private_message', `${target.name} è ${isWolf ? 'un LUPO' : 'NON un Lupo'}.`);
                }

                this.checkNightEnd();
            }
        }
        // Day - Discussion -> Force Vote
        else if (this.phase === 'DAY_DISCUSSION') {
            if (data.type === 'FORCE_VOTE') {
                this.phase = 'DAY_NOMINATION';
                this.votes = {};
                this.logs.push('Inizia la fase di Nomina (Indiziati).');
            }
        }
        // Day - Nomination (Everyone votes, including Ghosts)
        else if (this.phase === 'DAY_NOMINATION') {
            // Ghosts CAN vote here
            this.votes[socketId] = data.target;
            const totalVoters = Object.keys(this.players).length; // Everyone
            if (Object.keys(this.votes).length >= totalVoters) {
                this.resolveNomination();
            }
        }
        // Day - Lynching (Only Alive, Non-Nominees vote)
        else if (this.phase === 'DAY_LYNCHING' && player.isAlive) {
            // Nominees cannot vote? Rules don't explicitly say nominees can't vote in 2nd phase, 
            // but "Votano solo i giocatori non indiziati e ancora vivi". So YES, nominees excluded.
            if (this.nominees.includes(socketId)) return;

            this.votes[socketId] = data.target;

            const eligibleVoters = Object.values(this.players).filter(p => p.isAlive && !this.nominees.includes(p.id));
            if (Object.keys(this.votes).length >= eligibleVoters.length) {
                this.resolveLynching();
            }
        }

        this.broadcastState();
    }

    checkNightEnd() {
        const livingPlayers = Object.values(this.players).filter(p => p.isAlive);

        // Define who MUST act
        const wolves = livingPlayers.filter(p => p.role === 'WEREWOLF');
        const seer = livingPlayers.find(p => p.role === 'SEER');
        const bodyguard = livingPlayers.find(p => p.role === 'BODYGUARD');
        const owl = livingPlayers.find(p => p.role === 'OWL');
        const mythomaniac = livingPlayers.find(p => p.role === 'MYTHOMANIAC');

        let ready = true;

        // Wait for all wolves AND check for consensus
        const wolfActions = Object.values(this.nightActions).filter(a => a.role === 'WEREWOLF');
        if (wolfActions.length < wolves.length) {
            ready = false;
        } else {
            // All wolves voted, check if they voted for the same target
            const firstTarget = wolfActions[0].target;
            const allSame = wolfActions.every(a => a.target === firstTarget);
            if (!allSame) {
                ready = false;
                // Optional: Notify wolves they need to agree?
                // For now, just wait. The client will allow them to change votes.
            }
        }

        if (seer && !this.nightActions[seer.id]) ready = false;
        if (bodyguard && this.dayCount > 1 && !this.nightActions[bodyguard.id]) ready = false;
        if (owl && !this.nightActions[owl.id]) ready = false;
        if (mythomaniac && this.dayCount === 2 && !this.nightActions[mythomaniac.id]) ready = false;

        if (ready) {
            setTimeout(() => this.startDay(), 1000);
        }
    }

    resolveNomination() {
        const counts = {};
        Object.values(this.votes).forEach(t => counts[t] = (counts[t] || 0) + 1);

        // Sort by votes
        const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        // Take top 2
        this.nominees = sorted.slice(0, 2);

        // Owl Logic
        const owlAction = Object.values(this.nightActions).find(a => a.role === 'OWL');
        if (owlAction && owlAction.target) {
            if (!this.nominees.includes(owlAction.target)) {
                this.nominees.push(owlAction.target);
                this.logs.push(`Il Gufo ha aggiunto ${this.players[owlAction.target].name} agli indiziati!`);
            }
        }

        this.phase = 'DAY_DEFENSE';
        this.logs.push(`Indiziati: ${this.nominees.map(id => this.players[id].name).join(', ')}. Difendetevi!`);

        // Auto-advance to lynching after short delay or manual? Let's do manual for now via "FORCE_VOTE" equivalent
        // Actually, let's just wait 5 seconds then go to lynching for flow
        setTimeout(() => {
            this.phase = 'DAY_LYNCHING';
            this.votes = {};
            this.broadcastState();
        }, 5000);
    }

    resolveLynching() {
        const counts = {};
        Object.values(this.votes).forEach(t => counts[t] = (counts[t] || 0) + 1);

        // Sort by votes
        const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const victimId = sorted[0];

        if (victimId && this.players[victimId]) {
            this.players[victimId].isAlive = false;
            this.players[victimId].isGhost = true;
            this.lastLynchedRole = this.players[victimId].role;
            this.logs.push(`${this.players[victimId].name} è stato linciato.`);
        }

        this.checkWinCondition();
        if (this.phase !== 'END') {
            this.startNight();
        }
    }

    checkWinCondition() {
        const wolves = Object.values(this.players).filter(p => p.isAlive && p.role === 'WEREWOLF').length;
        const humans = Object.values(this.players).filter(p => p.isAlive && p.role !== 'WEREWOLF').length;

        // Possessed counts as human for calculation but wins with wolves
        // Werehamster counts as human for calculation

        if (wolves === 0) {
            this.phase = 'END';
            this.winner = 'HUMANS';
        } else if (wolves >= humans) {
            this.phase = 'END';
            this.winner = 'WEREWOLVES';
        }
    }

    getPublicState(socketId) {
        const player = this.players[socketId];
        const safePlayers = Object.values(this.players).map(p => {
            let role = 'UNKNOWN';
            if (socketId === p.id) role = p.role;
            if (this.phase === 'END') role = p.role;
            if (player && player.role === 'WEREWOLF' && p.role === 'WEREWOLF') role = 'WEREWOLF';
            if (player && player.role === 'MASON' && p.role === 'MASON') role = 'MASON';
            if (player && player.role === 'SPECTATOR') role = p.role;

            return {
                id: p.id,
                name: p.name,
                isAlive: p.isAlive,
                isGhost: p.isGhost,
                role: role
            };
        });

        let myAction = null;
        if (this.phase === 'NIGHT' && this.nightActions[socketId]) {
            myAction = this.nightActions[socketId].target;
        } else if ((this.phase === 'DAY_NOMINATION' || this.phase === 'DAY_LYNCHING') && this.votes[socketId]) {
            myAction = this.votes[socketId];
        }

        return {
            phase: this.phase,
            dayCount: this.dayCount,
            players: safePlayers,
            logs: this.logs,
            winner: this.winner,
            nominees: this.nominees,
            me: { ...player, myAction }
        };
    }

    broadcastState() {
        Object.keys(this.players).forEach(sid => {
            this.io.to(sid).emit('state_update', this.getPublicState(sid));
        });
        this.io.emit('god_state', {
            phase: this.phase,
            players: this.players,
            votes: this.votes,
            nightActions: this.nightActions,
            logs: this.logs
        });
    }
}
