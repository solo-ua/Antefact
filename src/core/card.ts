export enum Suit {
    Hearts = 'h',
    Diamonds = 'd',
    Clubs = 'c',
    Spades = 's'
}

export enum Rank {
    Two = '2',
    Three = '3',
    Four = '4',
    Five = '5',
    Six = '6',
    Seven = '7',
    Eight = '8',
    Nine = '9',
    Ten = 'T',
    Jack = 'J',
    Queen = 'Q',
    King = 'K',
    Ace = 'A'
}

export class Card {
    constructor(
        public readonly rank: Rank,
        public readonly suit: Suit
    ) {}

    toString(): string {
        return `${this.rank}${this.suit}`;
    }

    equals(other: Card): boolean {
        return this.rank === other.rank && this.suit === other.suit;
    }

    static fromCode(code: string): Card {
        if (code.length !== 2) {
            throw new Error(`Invalid card code: ${code}`);
        }
        const rankChar = code[0].toUpperCase();
        const suitChar = code[1].toLowerCase();

        const rank = Object.values(Rank).find(r => r === rankChar);
        const suit = Object.values(Suit).find(s => s === suitChar);

        if (!rank || !suit) {
            throw new Error(`Invalid rank or suit in code: ${code}`);
        }

        return new Card(rank as Rank, suit as Suit);
    }
}