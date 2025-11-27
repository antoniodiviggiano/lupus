import { io } from 'socket.io-client';

const URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`;

export const socket = io(URL, {
    autoConnect: false
});
