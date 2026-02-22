import { Player } from './player';
import { Deck } from './deck';
import { Card } from './card';

export class Table {
    private readonly maxPlayers: number = 6;
    private seats: (Player | null)[] = new Array(6).fill(null);
    private deck: Deck = new Deck();
    public pot: number = 0;
    public smallBlind: number;
    public bigBlind: number;
    public theFlop: Card[] = [];
    public theTurn: Card | null = null;
    public theRiver: Card | null = null;

    constructor(smallBlind: number, bigBlind: number) {
        this.smallBlind = smallBlind;
        this.bigBlind = bigBlind;
    }

    sitDown(player: Player, seatIndex?: number): boolean {
        if (seatIndex !== undefined) {
            if (seatIndex < 0 || seatIndex >= this.maxPlayers || this.seats[seatIndex] !== null) {
                return false;
            }
            this.seats[seatIndex] = player;
            return true;
        }

        const emptySeat = this.seats.findIndex(seat => seat === null);
        if (emptySeat !== -1) {
            this.seats[emptySeat] = player;
            return true;
        }
        return false;
    }

    standUp(seatIndex: number): void {
        if (seatIndex >= 0 && seatIndex < this.maxPlayers) {
            this.seats[seatIndex] = null;
        }
    }

    getActivePlayers(): Player[] {
        return this.seats.filter((player): player is Player => player !== null);
    }

    resetDeck(): void {
        this.deck.reset();
        this.deck.shuffle();
    }

    // Distribute the cards: 
    dealHoleCards(): void {
        const players = this.getActivePlayers();
        // Clear hands first
        players.forEach(p => p.clearHand());
        
        // Deal two cards to each player
        for (let i = 0; i < 2; i++) {
            for (const player of players) {
                const card = this.deck.draw();
                if (card) {
                    player.receiveCard(card);
                }
            }
        }
    }

    revealTheFlop(): void {
        for (let i=0; i<3; i++){
            this.theFlop.push(this.deck.draw()!);
        }
    }
    revealTheTurn(): void {
        this.theTurn = this.deck.draw()!;
    }
    revealTheRiver(): void {
        this.theRiver = this.deck.draw()!;
    }

}
