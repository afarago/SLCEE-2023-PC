import Card, { CardSuit } from './card';
import CardPile from './cardpile';
import CardSuitStack from './cardsuitstack';
import { IsCardSuit } from './card';

/**
 * Ordered card pile - for effective representation of bank collection ordered by suits
 */
export default class OrderedCardPile {
  static constructFromObject(data: any, obj?: OrderedCardPile) {
    if (data) {
      obj = obj || new OrderedCardPile();

      data = data.piles || data;
      if (data) {
        // Map type is lost during ts->js, cannot retrieve type info, this is a workaround!
        // obj.piles = Hydrate.convertToType(data, Map<CardSuit, CardSuitStack>);
        Object.getOwnPropertyNames(data).forEach((k: any) => {
          const stack = CardSuitStack.constructFromObject(data[k]);
          if (stack) obj?.piles.set(k, stack);
        });
      }
    }
    return obj;
  }

  constructor() {
    this.piles = new Map<CardSuit, CardSuitStack>();
  }

  piles: Map<CardSuit, CardSuitStack>;

  // -- override toJSON
  // -- architectural: it is ok from architectural prespective as de do not have any other subproperties
  toJSON() {
    // -- attention: default serialization cannot handle Map<>
    return Object.fromEntries(this.piles);
  }
  toBSON() {
    return this.toJSON();
  }

  get flatSize(): number {
    let count = 0;
    for (const [key, value] of this.piles.entries()) count += value.size;
    return count;
  }

  /**
   * Converts to CardPile object
   * @returns card pile
   */
  toCardPile(): CardPile {
    const retval = new CardPile();
    for (const [suit, pile] of this.piles.entries())
      for (const value of pile.stack) {
        retval.cards.push(new Card(suit, value));
      }
    return retval;
  }

  /**
   * Converts and fills up from a CardPile object
   */
  static fromCardPile(pile?: CardPile, obj?: OrderedCardPile): OrderedCardPile {
    obj = obj || new OrderedCardPile();
    obj.piles.clear();
    pile?.cards.forEach((card) => obj?.add(card));
    return obj;
  }

  /**
   * Adds a Card to the ordered card pile
   * @param value
   */
  add(card: Card): void {
    if (card && card.suit && card.value && IsCardSuit(card.suit)) {
      if (!this.piles.has(card.suit)) this.piles.set(card.suit, new CardSuitStack());
      this.piles.get(card.suit)?.add(card.value);
    }
  }

  /**
   * Except Method is used to return the elements which are present in the first data source but not in the second data source.
   * @param second
   * @returns
   */
  public except(second: OrderedCardPile): Card[] {
    const obj0 = this?.toCardPile();
    const obj1 = second?.toCardPile();
    return obj0?.except(obj1);
  }
}
