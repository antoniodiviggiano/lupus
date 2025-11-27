export class Game {
    constructor(io) {
        this.io = io;
        this.reset();
    }

    reset() {
        this.players = {};
        this.phase = 'LOBBY'; // LOBBY, NIGHT, DAY_DISCUSSION, DAY_VOTING, END
        this.subPhase = '';
        this.settings = { playerCount: 8 };
        this.nightActions = {};
        this.votes = {};
        this.dayCount = 0;
        this.logs = [];
        this.broadcastState();
    }

    addPlayer(socketId, name) {
        if (this.phase !== 'LOBBY') {
            // Allow reconnection logic here if needed
            return;
        }
        this.players[socketId] = {
            id: socketId,
            name: name || `Player ${Object.keys(this.players).length + 1}`,
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
        if (playerIds.length < 8) {
            // For testing, we might allow fewer, but official rules say 8.
            // We'll proceed for now.
        }
        this.settings = settings;
        this.assignRoles(playerIds.length);
        this.startNight();
    }

    assignRoles(count) {
        let roles = ['WEREWOLF', 'WEREWOLF', 'SEER'];

        if (count >= 9) roles.push('MEDIUM');
        if (count >= 10) roles.push('BODYGUARD');
        if (count >= 11) roles.push('OWL');
        if (count >= 12) roles.push('MASON', 'MASON');
        if (count >= 13) roles.push('WEREHAMSTER');
        if (count >= 14) roles.push('MYTHOMANIAC');
        if (count >= 15) roles.push('POSSESSED');
        if (count >= 16) roles.push('WEREWOLF');

        while (roles.length < count) {
            roles.push('VILLAGER');
        }

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
        this.logs.push(`Notte ${this.dayCount} iniziata.`);
        this.broadcastState();
    }

    startDay() {
        this.phase = 'DAY_DISCUSSION';
        this.votes = {};

        let victims = [];

        // Mythomaniac Action (Night 1 only)
        if (this.dayCount === 1) {
            const mythAction = Object.values(this.nightActions).find(a => a.role === 'MYTHOMANIAC');
            if (mythAction) {
                const targetPlayer = this.players[mythAction.target];
                if (targetPlayer) {
                    // Simplified: Copy role if Wolf or Seer, else become Villager? 
                    // Official: If Wolf -> Wolf. If Seer -> Seer. If Witch -> Witch. Else Villager.
                    // We'll just copy the role for simplicity or map it.
                    // Let's copy it.
                    const myId = Object.keys(this.nightActions).find(id => this.nightActions[id] === mythAction);
                    if (myId) {
                        this.players[myId].role = targetPlayer.role;
                        this.logs.push(`Il Mitomane ha cambiato ruolo.`);
                    }
                }
            }
        }

        // Werewolves target
        const wolfVotes = Object.values(this.nightActions).filter(a => a.role === 'WEREWOLF').map(a => a.target);
        if (wolfVotes.length > 0) {
            const counts = {};
            wolfVotes.forEach(v => counts[v] = (counts[v] || 0) + 1);
            const target = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

            // Werehamster immunity
            if (this.players[target].role !== 'WEREHAMSTER') {
                victims.push(target);
            } else {
                this.logs.push(`I Lupi Mannari hanno attaccato, ma hanno fallito!`);
            }
        }

        // Seer Action (Check for Werehamster death)
        const seerAction = Object.values(this.nightActions).find(a => a.role === 'SEER');
        if (seerAction) {
            const targetPlayer = this.players[seerAction.target];
            if (targetPlayer && targetPlayer.role === 'WEREHAMSTER') {
                victims.push(seerAction.target);
                this.logs.push(`Il Criceto Mannaro è morto di paura!`);
            }
        }

        // Bodyguard protection
        const bgAction = Object.values(this.nightActions).find(a => a.role === 'BODYGUARD');
        if (bgAction && victims.includes(bgAction.target)) {
            victims = victims.filter(v => v !== bgAction.target);
            this.logs.push(`La Guardia del Corpo ha protetto ${this.players[bgAction.target].name}.`);
        }

        // Kill victims
        victims.forEach(vid => {
            if (this.players[vid]) {
                this.players[vid].isAlive = false;
                this.players[vid].isGhost = true;
                this.logs.push(`${this.players[vid].name} è stato ucciso durante la notte.`);
            }
        });

        this.checkWinCondition();
        this.broadcastState();
    }

    handleAction(socketId, data) {
        const player = this.players[socketId];
        if (!player || !player.isAlive) return;

        if (this.phase === 'NIGHT') {
            if (['WEREWOLF', 'SEER', 'BODYGUARD'].includes(player.role)) {
                this.nightActions[socketId] = { role: player.role, target: data.target };
                this.checkNightEnd();
            }
            if (player.role === 'MYTHOMANIAC' && this.dayCount === 1) {
                this.nightActions[socketId] = { role: player.role, target: data.target };
                this.checkNightEnd();
            }
        } else if (this.phase === 'DAY_DISCUSSION') {
            if (data.type === 'FORCE_VOTE') {
                this.phase = 'DAY_VOTING';
                this.votes = {};
                this.logs.push('Votazione iniziata!');
            }
        } else if (this.phase === 'DAY_VOTING') {
            this.votes[socketId] = data.target;
            const livingPlayers = Object.values(this.players).filter(p => p.isAlive);
            if (Object.keys(this.votes).length >= livingPlayers.length) {
                this.resolveVoting();
            }
        }

        this.broadcastState();
    }

    checkNightEnd() {
        const livingPlayers = Object.values(this.players).filter(p => p.isAlive);
        const wolves = livingPlayers.filter(p => p.role === 'WEREWOLF');
        const seer = livingPlayers.find(p => p.role === 'SEER');
        const bodyguard = livingPlayers.find(p => p.role === 'BODYGUARD');
        const mythomaniac = livingPlayers.find(p => p.role === 'MYTHOMANIAC');

        let ready = true;

        // Wait for all wolves
        const wolfActions = Object.values(this.nightActions).filter(a => a.role === 'WEREWOLF');
        if (wolfActions.length < wolves.length) ready = false;

        // Wait for Seer
        if (seer) {
            const seerAction = Object.values(this.nightActions).find(a => a.role === 'SEER');
            if (!seerAction) ready = false;
        }

        // Wait for Bodyguard
        if (bodyguard) {
            const bgAction = Object.values(this.nightActions).find(a => a.role === 'BODYGUARD');
            if (!bgAction) ready = false;
        }

        // Wait for Mythomaniac (Night 1 only)
        if (this.dayCount === 1 && mythomaniac) {
            const mythAction = Object.values(this.nightActions).find(a => a.role === 'MYTHOMANIAC');
            if (!mythAction) ready = false;
        }

        if (ready) {
            // Add small delay for UX
            setTimeout(() => this.startDay(), 1000);
        }
    }

    resolveVoting() {
        // Tally votes
        const counts = {};
        Object.values(this.votes).forEach(target => {
            counts[target] = (counts[target] || 0) + 1;
        });

        // Find max
        // ...
        // Kill player
        // ...
        this.phase = 'NIGHT'; // Loop back
        this.startNight();
    }

    checkWinCondition() {
        const wolves = Object.values(this.players).filter(p => p.isAlive && p.role === 'WEREWOLF').length;
        const humans = Object.values(this.players).filter(p => p.isAlive && p.role !== 'WEREWOLF').length;

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
        // Hide roles of others unless game over
        const safePlayers = Object.values(this.players).map(p => {
            let role = 'UNKNOWN';
            if (socketId === p.id) role = p.role;
            if (this.phase === 'END') role = p.role;
            // Wolves see each other
            if (player && player.role === 'WEREWOLF' && p.role === 'WEREWOLF') role = 'WEREWOLF';

            return {
                id: p.id,
                name: p.name,
                isAlive: p.isAlive,
                isGhost: p.isGhost,
                role: role
            };
        });

        return {
            phase: this.phase,
            dayCount: this.dayCount,
            players: safePlayers,
            logs: this.logs,
            winner: this.winner,
            me: player
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
