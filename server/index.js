import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Game } from './game.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const game = new Game(io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current state to new connection
    socket.emit('state_update', game.getPublicState(socket.id));

    socket.on('join', (name) => {
        game.addPlayer(socket.id, name);
    });

    socket.on('start_game', (settings) => {
        game.startGame(settings);
    });

    socket.on('action', (data) => {
        game.handleAction(socket.id, data);
    });

    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
    });

    // Debug/Admin
    socket.on('reset', () => {
        game.reset();
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
