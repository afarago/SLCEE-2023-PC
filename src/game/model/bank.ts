import OrderedCardPile from "./orderedcardpile";

/**
 * Bank - object for a player's bank
 */
export default class Bank extends OrderedCardPile {
  get bankvalue(): number {
    let retval = [...this.piles.entries()].reduce((acc, kvp) => acc + kvp?.[1]?.max(), 0);
    return retval;
  }
}
