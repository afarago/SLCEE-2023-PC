import OrderedCardPile from './orderedcardpile';

/**
 * Bank - object for a player's bank
 */
export default class Bank extends OrderedCardPile {
  static override constructFromObject(data: any, obj?: Bank) {
    if (data) {
      obj = obj || new Bank();

      OrderedCardPile.constructFromObject(data, obj);
    }
    return obj;
  }

  get bankvalue(): number {
    const retval = [...this.piles.entries()].reduce((acc, [_suit, stack]) => acc + stack?.max(), 0);
    return retval;
  }
}
