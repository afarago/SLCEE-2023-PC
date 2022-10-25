/* tslint:disable:max-classes-per-file */

import * as utils from "../utils";

export type PlayerId = number;
export type ContextId = number;
export type MatchId = number;

export class Player {
  uid: PlayerId;
  name: string;
  constructor(uid: PlayerId, name: string) {
    this.uid = uid;
    this.name = name;
  }
}

export const OCardSuit = {
  Anchor: 0,
  Hook: 1,
  Cannon: 2,
  Key: 3,
  Chest: 4,
  Map: 5,
  Oracle: 6,
  Sword: 7,
  Kraken: 8,
  Mermaid: 9,
}; // as const;
export type CardSuit = keyof typeof OCardSuit;
// export type Suit = typeof OSuit[keyof typeof OSuit];
// export type Suit =
//   | "Anchor"
//   | "Hook"
//   | "Cannon"
//   | "Key"
//   | "Chest"
//   | "Map"
//   | "Oracle"
//   | "Sword"
//   | "Kraken"
//   | "Mermaid";

export type CardValueBase = 2 | 3 | 4 | 5 | 6 | 7;
export type CardValue = CardValueBase | 8 | 9;
export type CardAbbreviation = [CardSuit, CardValue];
export class Card {
  suit: CardSuit;
  value: CardValue;

  constructor(suit: CardSuit, value: CardValue) {
    this.suit = suit;
    this.value = value;
  }
  static fromAbbreviation(abbreviation: CardAbbreviation) {
    return new Card(abbreviation[0], abbreviation[1]);
  }
}

export class CardPile {
  readonly cards: Array<Card>;
  //-- architecture warning - should not derive from Array<Card> directly as lodash Lodash only clones index values (and some meta values) of arrays.
  constructor() {
    this.cards = new Array<Card>();
  }
  get length(): number {
    return this.cards.length;
  }
  set length(value: number) {
    this.cards.length = value;
  }
}
export class CardSuitStack extends Set<CardValue> {
  max() {
    return Math.max.apply(null, Array.from(this.values()));
  }
}
export class OrderedCardPile extends Map<CardSuit, CardSuitStack> {
  get flatSize(): number {
    let count = 0;
    for (let [key, value] of this.entries()) count += value.size;
    return count;
  }
}

export class Bank extends OrderedCardPile {}

export class PlayArea extends CardPile {} // or Map<Suit, number>;

export type EffectPointer = {
  moveIndex: number;
  eventIndex: number;
};

export { DrawCardPile } from "./drawcardpile";
export { MatchState } from "./matchstate";
export { Match } from "./match";
export { Move } from "./move";
export * from "./matchevent";
