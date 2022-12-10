import * as util from 'util';

export const OCardSuit = {
  Anchor: 'Anchor',
  Hook: 'Hook',
  Cannon: 'Cannon',
  Key: 'Key',
  Chest: 'Chest',
  Map: 'Map',
  Oracle: 'Oracle',
  Sword: 'Sword',
  Kraken: 'Kraken',
  Mermaid: 'Mermaid',
}; // as const;
export type CardSuit = keyof typeof OCardSuit;
export function IsCardSuit(value?: string): value is CardSuit {
  return Object.values(OCardSuit).includes(value as CardSuit);
}

/**
 * Card interface representing a game card
 * @example { "suit": "Mermaid", "value": 9 }
 * @example [ "Mermaid", 9 ]
 */
export interface ICard {
  suit?: CardSuit;
  value?: CardValue;
}

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

/**
 * Card Value including all possible values
 */
export type CardValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
// TODO: ensure it is treated as an int, Extract<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, integer>;

/**
 * Card interface representing a game card
 * @example { "suit": "Mermaid", "value": 9 }
 * @example [ "Mermaid", 9 ]
 */
class Card implements ICard {
  static constructFromObject(data: any, obj?: Card) {
    if (data) {
      obj = obj || new Card();

      if (data.hasOwnProperty('suit') && data.hasOwnProperty('value')) {
        // -- full form: {"suit":"Kraken", "value":4}
        obj.suit = data.suit;
        obj.value = data.value;
      } else if (Array.isArray(data) && data.length === 2 && IsCardSuit(data[0]) && Number.isFinite(data[1])) {
        // -- tuple form: ["Kraken",4]
        obj.suit = data[0];
        obj.value = data[1];
      } else {
        // -- abbreviated form: {"Kraken":4}, one card per object
        const asuitvalue = Object.keys(OCardSuit).find((asuit) => data.hasOwnProperty(asuit)) as CardSuit;
        if (asuitvalue) {
          obj.suit = asuitvalue;
          obj.value = data[asuitvalue];
        }
      }

      // -- check card validity
      obj.checkCard(data);
    }
    return obj;
  }

  suit?: CardSuit;
  value?: CardValue;

  // //-- override toJSON
  // toJSON(): ICard {
  //   return this; // [this.suit, this.value];
  // }
  // toBSON() {
  //   return this.toJSON();
  // }

  constructor(suit?: CardSuit, value?: CardValue) {
    this.suit = suit;
    this.value = value;
    if (this.suit !== undefined && this.value !== undefined) this.checkCard();
  }

  private checkCard(source?: ICard) {
    if (
      !IsCardSuit(this.suit) ||
      !(this.suit !== OCardSuit.Mermaid ? this.value >= 2 && this.value <= 7 : this.value >= 4 && this.value <= 9)
    ) {
      throw new Error(`Invalid Card '${util.inspect(source)}'`);
    }
  }

  /**
   * Compares whether the two cards are equal
   * @param second
   * @returns true if equals
   */
  equals(second: ICard): boolean {
    return second?.suit === this.suit && second?.value === this.value;
  }
}

export default Card;
