import { SupportsHydration } from "./model";

export const OCardSuit = {
  Anchor: "Anchor",
  Hook: "Hook",
  Cannon: "Cannon",
  Key: "Key",
  Chest: "Chest",
  Map: "Map",
  Oracle: "Oracle",
  Sword: "Sword",
  Kraken: "Kraken",
  Mermaid: "Mermaid",
}; // as const;
export type CardSuit = keyof typeof OCardSuit;
export function IsCardSuit(cardSuit?: string): cardSuit is CardSuit {
  return !!cardSuit;
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
 * Card abbreviation
 */
//export type CardValueBase = 2 | 3 | 4 | 5 | 6 | 7;
//export type CardValue = CardValueBase | 8 | 9;
//export type CardAbbreviation = [CardSuit, number]; //CardValue];

/**
 * Card object
 */
export default class Card implements SupportsHydration {
  populate(pojo: any): any {
    if (pojo.hasOwnProperty("suit") && pojo.hasOwnProperty("value")) {
      //-- full form: {"suit":"Kraken", "value":4}
      this.suit = pojo.suit;
      this.value = pojo.value;
    } else if (
      Array.isArray(pojo) &&
      pojo.length == 2 &&
      IsCardSuit(pojo[0]) &&
      typeof pojo[1] === "number"
    ) {
      //-- tuple form: ["Kraken",4]
      this.suit = pojo[0];
      this.value = pojo[1];
    } else {
      //-- abbreviated form: {"Kraken":4}, one card per object
      const asuitvalue = Object.keys(OCardSuit).find(
        (asuit) => pojo.hasOwnProperty(asuit) && IsCardSuit(asuit) && typeof pojo[asuit] == "number"
      ) as CardSuit;
      if (asuitvalue) {
        this.suit = asuitvalue;
        this.value = pojo[asuitvalue];
      } else throw new Error("Invalid Card");
    }
    return this;
  }

  suit?: CardSuit;
  value?: number; //CardValue;

  //-- override toJSON
  toJSON() {
    return [this.suit, this.value];
  }
  toBSON() {
    return this.toJSON();
  }

  constructor(suit?: CardSuit, value?: number) {
    this.suit = suit;
    this.value = value;
    if (
      suit !== undefined &&
      value !== undefined &&
      !(suit !== OCardSuit.Mermaid && value >= 2 && value <= 7) &&
      !(suit === OCardSuit.Mermaid && value >= 4 && value <= 9)
    )
      throw new Error("Invalid Card");
  }
}
