import { Card } from './card';

export class Player {
    public hand: Card[] = [];
    public chips: number = 0;
    private userId: number;
    constructor(
        userId: number,
        public name: string,
        initialChips: number = 1000
    ) {
        this.chips = initialChips;
        this.userId = userId;
    }

    addChips(amount: number): void {
        this.chips += amount;
    }

    removeChips(amount: number): number {
        const removed = Math.min(this.chips, amount);
        this.chips -= removed;
        return removed;
    }

    receiveCard(card: Card): void {
        this.hand.push(card);
    }

    clearHand(): void {
        this.hand = [];
    }
}