import { Player } from './player.js';
import { Deck } from './deck.js';
import { Card } from './card.js';
import { HandEvaluator, HandEvaluation, HandRank } from './handEvaluator.js';

export type PlayerAction =
  | { type: 'check' }
  | { type: 'bet'; amount: number }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'fold' };

export class Table {
    private readonly maxPlayers: number = 6;
    private players: (Player | null)[] = new Array(6).fill(null);
    private deck: Deck = new Deck();
    public pot: number = 0;
    public smallBlind: number;
    public bigBlind: number;
    public theFlop: Card[] = [];
    public theTurn: Card | null = null;
    public theRiver: Card | null = null;
    private currentBet: number = 0;
    private round: number = 0;
    private dealerIndex: number = 0;
    public onStateChange?: (state: any) => void;
    

    constructor(smallBlind: number, bigBlind: number) {
        this.smallBlind = smallBlind;
        this.bigBlind = bigBlind;
    }

    sitDown(player: Player, seatIndex?: number): boolean {
        if (seatIndex !== undefined) {
            if (seatIndex < 0 || seatIndex >= this.maxPlayers || this.players[seatIndex] !== null) {
                return false;
            }
            this.players[seatIndex] = player;
            return true;
        }

        const emptySeat = this.players.findIndex(seat => seat === null);
        if (emptySeat !== -1) {
            this.players[emptySeat] = player;
            return true;
        }
        return false;
    }

    standUp(seatIndex: number): void {
        if (seatIndex >= 0 && seatIndex < this.maxPlayers) {
            this.players[seatIndex] = null;
        }
    }

    getActivePlayers(): Player[] {
        return this.players.filter((player): player is Player => player !== null);
    }

    resetDeck(): void {
        this.deck.reset();
        this.deck.shuffle();
    }

    // Distribute the cards: 
    dealHoleCards(): void {
        const players = this.getActivePlayers();
        players.forEach(p => p.clearHand());
        
        for (let i = 0; i < 2; i++) {
            for (const player of players) {
                const card = this.deck.draw();
                if (card) {
                    player.receiveCard(card);
                }
            }
        }
        this.emitState();
    }

    revealTheFlop(): void {
        for (let i=0; i<3; i++){
            this.theFlop.push(this.deck.draw()!);
        }
        this.emitState();
    }
    revealTheTurn(): void {
        this.theTurn = this.deck.draw()!;
        this.emitState();
    }
    revealTheRiver(): void {
        this.theRiver = this.deck.draw()!;
        this.emitState();
    }
    async playHand(): Promise<void> {
        this.resetDeck();
        this.dealHoleCards();
        this.round = 0;
        
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) return;

        // Rotate Dealer
        this.dealerIndex = (this.dealerIndex + 1) % activePlayers.length;
        
        // Post Blinds
        this.postBlinds();
        
        // Betting rounds
        for (let i = 0; i < 4; i++) {
            const stillActive = this.getActivePlayers().filter(p => !p.hasFolded);
            const canStillAct = stillActive.filter(p => !p.isAllIn);

            if (stillActive.length <= 1) break;

            // If only one player (or none) can still make actions, but there are multiple active players
            // (i.e., others are all-in), reveal all remaining cards and finish.
            if (canStillAct.length <= 1) {
                console.log("No more betting possible. Fast-forwarding reveals...");
                while (this.round < 3) {
                    switch(this.round){
                        case 0: this.revealTheFlop(); break;
                        case 1: this.revealTheTurn(); break;
                        case 2: this.revealTheRiver(); break;
                    }
                    this.round++;
                }
                break;
            }

            // Pre-flop (round 0) starts with the player after Big Blind
            // Post-flop rounds start with the first active player after the Dealer
            let startingIndex = 0;
            if (i === 0) {
                startingIndex = (this.dealerIndex + 3) % activePlayers.length; // UTG
            } else {
                startingIndex = (this.dealerIndex + 1) % activePlayers.length;
            }

            await this.processBettingRound(startingIndex);
            
            if (stillActive.length <= 1) break;
        }

        this.determineWinner();
    }

    private determineWinner(): void {
        const activePlayers = this.getActivePlayers().filter(p => !p.hasFolded);
        
        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            console.log(`Winner by fold: ${winner.name}. Awarding pot: ${this.pot}`);
            winner.addChips(this.pot);
            this.pot = 0;
            return;
        }

        console.log("Showdown! Comparing hands...");
        const communityCards = [...this.theFlop];
        if (this.theTurn) communityCards.push(this.theTurn);
        if (this.theRiver) communityCards.push(this.theRiver);

        const evaluations = activePlayers.map(player => ({
            player,
            evaluation: HandEvaluator.evaluate([...player.hand, ...communityCards])
        }));

        // Sort by evaluation descending
        evaluations.sort((a, b) => HandEvaluator.compare(b.evaluation, a.evaluation));

        // Handle possible ties (split pot)
        const winners = evaluations.filter(e => 
            HandEvaluator.compare(e.evaluation, evaluations[0].evaluation) === 0
        );

        const share = Math.floor(this.pot / winners.length);
        winners.forEach(w => {
            console.log(`Winner: ${w.player.name} with ${HandRank[w.evaluation.rank]}`);
            w.player.addChips(share);
        });

        this.pot = 0;
    }
    async processBettingRound(startingIndex: number = 0): Promise<void> {
        let playersToAct = this.getActivePlayers(); // Keep all active players for indexing
        let lastRaiser: Player | null = null;
        let currentIndex = startingIndex % playersToAct.length;

        // Continue as long as there are players who haven't matched the current bet
        // or if a raise happened and others need to respond.
        let roundComplete = false;
        
        while (!roundComplete) {
            const player = playersToAct[currentIndex];
            
            if (player && !player.hasFolded && !player.isAllIn) {
                // Determine allowed actions based on currentBet
                const action = await player.decidedAction(this.currentBet);
                this.handlePlayerAction(player, action);
                
                if (action.type === 'raise' || action.type === 'bet') {
                    lastRaiser = player;
                }
            }

            currentIndex = (currentIndex + 1) % playersToAct.length;
            
            // Check if we've circled back to the person who made the last aggressive move
            // and everyone else has called or folded.
            const stillActive = playersToAct.filter(p => !p.hasFolded);
            const canStillAct = stillActive.filter(p => !p.isAllIn);

            if (stillActive.length <= 1 || canStillAct.length <= 1) {
                // If only one player is left, or only one player can still make actions, 
                // and everyone has matched the bet, we are done.
                if (lastRaiser && playersToAct[currentIndex] === lastRaiser) {
                    roundComplete = true;
                } else if (!lastRaiser && currentIndex === 0) {
                    roundComplete = true;
                } else if (canStillAct.length === 0) {
                    // Everyone who is still in the hand is All-In
                    roundComplete = true;
                } else if (canStillAct.length === 1 && canStillAct[0].currentBet === this.currentBet) {
                    // Only one player can act, but they've already matched the current bet
                    roundComplete = true;
                }
            } else if (lastRaiser && playersToAct[currentIndex] === lastRaiser) {
                roundComplete = true;
            } else if (!lastRaiser && currentIndex === 0) {
                // If no one bet/raised, once we circle back to the start, it's done
                roundComplete = true;
            }
        }
        
        // After the round, collect all bets into the pot
        this.getActivePlayers().forEach(p => {
            this.pot += p.currentBet;
            p.currentBet = 0;
        });
        this.currentBet = 0;

        if(roundComplete){
            switch(this.round){
                case 0: this.revealTheFlop();break;
                case 1: this.revealTheTurn();break;
                case 2: this.revealTheRiver();break;
            } 
            // Increment round to determine which cards should be exposed
            this.round++; 
        }
    }

    private postBlinds(): void {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) return;

        // In a 2-player game (Heads Up), Dealer is Small Blind
        const isHeadsUp = activePlayers.length === 2;
        const sbIndex = isHeadsUp ? this.dealerIndex : (this.dealerIndex + 1) % activePlayers.length;
        const bbIndex = isHeadsUp ? (this.dealerIndex + 1) % activePlayers.length : (this.dealerIndex + 2) % activePlayers.length;

        const sbPlayer = activePlayers[sbIndex];
        const bbPlayer = activePlayers[bbIndex];

        // Small Blind
        sbPlayer.removeChips(this.smallBlind);
        sbPlayer.currentBet = this.smallBlind;
        
        // Big Blind
        bbPlayer.removeChips(this.bigBlind);
        bbPlayer.currentBet = this.bigBlind;

        this.currentBet = this.bigBlind;
    }

    private handlePlayerAction(player: Player, action: PlayerAction): void {
        switch (action.type) {
            case 'fold':
                player.hasFolded = true;
                break;
            case 'check':
                // Do nothing
                break;
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                player.removeChips(callAmount);
                player.currentBet += callAmount;
                break;
            case 'bet':
            case 'raise':
                const totalNewBet = action.amount;
                const additionalAmount = totalNewBet - player.currentBet;
                player.removeChips(additionalAmount);
                player.currentBet = totalNewBet;
                this.currentBet = totalNewBet;
                break;
        }
    }

    public getFullState(): any {
        return {
            pot: this.pot,
            currentBet: this.currentBet,
            communityCards: {
                flop: this.theFlop,
                turn: this.theTurn,
                river: this.theRiver
            },
            players: this.getActivePlayers().map(p => ({
                name: p.name,
                chips: p.chips,
                currentBet: p.currentBet,
                hasFolded: p.hasFolded,
                isAllIn: p.isAllIn
            }))
        };
    }

    private emitState(): void {
        if (this.onStateChange) {
            this.onStateChange(this.getFullState());
        }
    }

}
