import { WebSocketServer, WebSocket } from 'ws';
import { Table } from '../../core/table.js';
import { Player } from '../../core/player.js';

const wss = new WebSocketServer({ port: 8080 });
const table = new Table(10, 20); // SB: 10, BB: 20

// Map to track connected sockets and their associated players
const clients = new Map<WebSocket, Player>();

console.log('Poker Server started on ws://localhost:8080');

table.onStateChange = (state) => {
    broadcast({ type: 'STATE_UPDATE', state });
};

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'JOIN_GAME':
                    const player = new Player(Date.now(), message.name, 1000);
                    
                    player.onActionRequired = (bet) => {
                        ws.send(JSON.stringify({ type: 'ACTION_REQUIRED', currentBet: bet }));
                    };

                    clients.set(ws, player);
                    
                    if (table.sitDown(player)) {
                        ws.send(JSON.stringify({ type: 'JOINED', player, state: table.getFullState() }));
                        broadcast({ type: 'PLAYER_SAT', player });
                    } else {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Table is full' }));
                    }
                    break;

                case 'SUBMIT_ACTION':
                    const p = clients.get(ws);
                    if (p) {
                        p.submitAction(message.action);
                    }
                    break;

                case 'START_HAND':
                    // In a real game, this would be automatic or triggered by the dealer
                    console.log('Starting a hand...');
                    await table.playHand();
                    break;
            }
        } catch (e) {
            console.error('Error handling message:', e);
        }
    });

    ws.on('close', () => {
        const player = clients.get(ws);
        if (player) {
            console.log(`${player.name} disconnected`);
            // Handle player standing up/leaving
            clients.delete(ws);
        }
    });
});

function broadcast(message: any) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}
