import { Card } from './card.js';
import { PlayerAction } from './table.js';

export class Player {
    public hand: Card[] = [];
    public chips: number = 0;
    private userId: number;
    public currentBet: number = 0;
    public hasFolded: boolean = false;
    private resolveAction?: (action: PlayerAction) => void;
    public onActionRequired?: (currentBet: number) => void;

    public get isAllIn(): boolean {
        return this.chips === 0 && !this.hasFolded;
    }


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

    /*
        The following will create a new Promise that the resolveAction will have to inject into the 
        Promise system, it doesnt return anything but creates a Promise that will later have a value and be used
        it identifies what DATA type the promise will have (its resolve will be a PlayerAction)
    */

    async decidedAction(currentTableBet: number): Promise<PlayerAction> {
        if (this.onActionRequired) {
            this.onActionRequired(currentTableBet);
        }
        return new Promise((resolve) => {
            this.resolveAction = resolve;
        });
    }

    // the following method will be called by a UI click 

    submitAction(action: PlayerAction): void {
        if (this.resolveAction) {
            this.resolveAction(action);
            this.resolveAction = undefined;
        }
    }
}