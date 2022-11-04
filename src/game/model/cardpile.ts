import { SupportsHydration } from "./model";
import Card from "./card";

/**
 * Card pile object
 */
export default class CardPile implements SupportsHydration {
  populate(pojo: any) {
    let pojoiter = pojo?.hasOwnProperty("cards") ? pojo.cards : pojo;
    if (Array.isArray(pojoiter))
      this.cards = pojoiter?.map((cardpojo: any) => new Card().populate(cardpojo));
    return this;
  }

  /*readonly*/
  cards: Array<Card>;
  //-- architecture warning - should not derive from Array<Card> directly as lodash Lodash only clones index values (and some meta values) of arrays.
  //-- architecture warning - should not override toJSON to default as for DrawCardPile we will need a cards + properties separately in the storage structure

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
