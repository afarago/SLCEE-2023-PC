import { Hydrate } from '../../utils/hydration.util';
import Card from './card';

/**
 * Card pile object
 */
export default class CardPile {
  static constructFromObject(data: any, obj?: CardPile) {
    if (data) {
      obj = obj || new CardPile();

      data = data.cards || data;
      if (data) obj.cards = Hydrate.convertToType(data, [Card]);
    }
    return obj;
  }

  cards: Card[];
  // -- architecture warning - should not derive from Array<Card> directly as lodash Lodash only clones index values (and some meta values) of arrays.
  // -- architecture warning - should not override toJSON to default as for DrawCardPile we will need a cards + properties separately in the storage structure

  constructor() {
    this.cards = new Array<Card>();
  }
  get length(): number {
    return this.cards.length;
  }
  set length(value: number) {
    this.cards.length = value;
  }

  /**
   * Except Method is used to return the elements which are present in the first data source but not in the second data source.
   * @param second
   * @returns
   */
  public except(second?: CardPile): Card[] {
    if (!second) return this.cards;
    return this.cards.filter((ca) => second.cards?.findIndex((cb) => ca.equals(cb)) < 0);
  }
}
