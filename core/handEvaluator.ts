import { Card, Rank, Suit } from './card.js';

export enum HandRank {
    HighCard = 0,
    OnePair = 1,
    TwoPair = 2,
    ThreeOfAKind = 3,
    Straight = 4,
    Flush = 5,
    FullHouse = 6,
    FourOfAKind = 7,
    StraightFlush = 8,
    RoyalFlush = 9
}

export interface HandEvaluation {
    rank: HandRank;
    kickers: number[]; // Used for tie-breaking
}

export class HandEvaluator {
    private static rankValues: Record<Rank, number> = {
        [Rank.Two]: 2,
        [Rank.Three]: 3,
        [Rank.Four]: 4,
        [Rank.Five]: 5,
        [Rank.Six]: 6,
        [Rank.Seven]: 7,
        [Rank.Eight]: 8,
        [Rank.Nine]: 9,
        [Rank.Ten]: 10,
        [Rank.Jack]: 11,
        [Rank.Queen]: 12,
        [Rank.King]: 13,
        [Rank.Ace]: 14
    };

    static evaluate(cards: Card[]): HandEvaluation {
        // Need to find the best 5-card combination from up to 7 cards
        // For simplicity, we'll sort cards by value descending
        const sortedCards = [...cards].sort((a, b) => this.rankValues[b.rank] - this.rankValues[a.rank]);
        
        // This is a complex task. For the first iteration, let's implement the checks
        const evaluations: HandEvaluation[] = [];

        // Check for Flush
        const flushSuit = this.getFlushSuit(sortedCards);
        const isFlush = !!flushSuit;

        // Check for Straight
        const straightHighCard = this.getStraightHighCard(sortedCards);
        const isStraight = straightHighCard !== null;

        if (isFlush && isStraight) {
            const flushCards = sortedCards.filter(c => c.suit === flushSuit);
            const sfHigh = this.getStraightHighCard(flushCards);
            if (sfHigh === 14) return { rank: HandRank.RoyalFlush, kickers: [] };
            if (sfHigh !== null) return { rank: HandRank.StraightFlush, kickers: [sfHigh] };
        }

        const groups = this.getGroups(sortedCards);
        const groupCounts = Object.values(groups).sort((a, b) => b.length - a.length);

        if (groupCounts[0].length === 4) {
            const quadValue = groupCounts[0][0];
            const kicker = sortedCards.find(c => this.rankValues[c.rank] !== quadValue)!;
            return { rank: HandRank.FourOfAKind, kickers: [quadValue, this.rankValues[kicker.rank]] };
        }

        if (groupCounts[0].length === 3 && groupCounts.length > 1 && groupCounts[1].length >= 2) {
            return { rank: HandRank.FullHouse, kickers: [groupCounts[0][0], groupCounts[1][0]] };
        }

        if (isFlush) {
            const flushCards = sortedCards.filter(c => c.suit === flushSuit).slice(0, 5);
            return { rank: HandRank.Flush, kickers: flushCards.map(c => this.rankValues[c.rank]) };
        }

        if (isStraight) {
            return { rank: HandRank.Straight, kickers: [straightHighCard] };
        }

        if (groupCounts[0].length === 3) {
            const tripValue = groupCounts[0][0];
            const kickers = sortedCards.filter(c => this.rankValues[c.rank] !== tripValue).slice(0, 2);
            return { rank: HandRank.ThreeOfAKind, kickers: [tripValue, ...kickers.map(c => this.rankValues[c.rank])] };
        }

        if (groupCounts.length > 1 && groupCounts[0].length === 2 && groupCounts[1].length === 2) {
            const pair1 = groupCounts[0][0];
            const pair2 = groupCounts[1][0];
            const kicker = sortedCards.find(c => this.rankValues[c.rank] !== pair1 && this.rankValues[c.rank] !== pair2)!;
            return { rank: HandRank.TwoPair, kickers: [pair1, pair2, this.rankValues[kicker.rank]] };
        }

        if (groupCounts[0].length === 2) {
            const pairValue = groupCounts[0][0];
            const kickers = sortedCards.filter(c => this.rankValues[c.rank] !== pairValue).slice(0, 3);
            return { rank: HandRank.OnePair, kickers: [pairValue, ...kickers.map(c => this.rankValues[c.rank])] };
        }

        return { rank: HandRank.HighCard, kickers: sortedCards.slice(0, 5).map(c => this.rankValues[c.rank]) };
    }

    private static getFlushSuit(cards: Card[]): Suit | null {
        const counts: Record<string, number> = {};
        for (const card of cards) {
            counts[card.suit] = (counts[card.suit] || 0) + 1;
            if (counts[card.suit] >= 5) return card.suit;
        }
        return null;
    }

    private static getStraightHighCard(cards: Card[]): number | null {
        const values = Array.from(new Set(cards.map(c => this.rankValues[c.rank]))).sort((a, b) => b - a);
        
        // Check for regular straights
        for (let i = 0; i <= values.length - 5; i++) {
            if (values[i] - values[i + 4] === 4) return values[i];
        }

        // Check for A-5 straight
        if (values.includes(14) && values.includes(5) && values.includes(4) && values.includes(3) && values.includes(2)) {
            return 5;
        }

        return null;
    }

    private static getGroups(cards: Card[]): Record<number, number[]> {
        const groups: Record<number, number[]> = {};
        for (const card of cards) {
            const val = this.rankValues[card.rank];
            if (!groups[val]) groups[val] = [];
            groups[val].push(val);
        }
        return groups;
    }

    static compare(a: HandEvaluation, b: HandEvaluation): number {
        if (a.rank !== b.rank) return a.rank - b.rank;
        for (let i = 0; i < a.kickers.length; i++) {
            if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
        }
        return 0;
    }
}
