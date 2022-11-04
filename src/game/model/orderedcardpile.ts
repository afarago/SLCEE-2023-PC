import CardSuitStack from "./cardsuitstack";
import { CardSuit } from "./card";

/**
 * Ordered card pile - for effective representation of bank collection ordered by suits
 */
export default class OrderedCardPile {
  populate(pojo: any) {
    this.piles.clear();

    const pojoiter = pojo.piles || pojo;
    if (pojoiter)
      Object.getOwnPropertyNames(pojoiter).forEach((k: any, v: any, arr: any) =>
        this.piles.set(k, new CardSuitStack().populate(pojoiter[k]))
      );
    return this;
  }

  constructor() {
    this.piles = new Map<CardSuit, CardSuitStack>();
  }

  piles: Map<CardSuit, CardSuitStack>;

  //-- override toJSON
  //-- architectural: it is ok from architectural prespective as de do not have any other subproperties
  toJSON() {
    //-- attention: default serialization cannot handle Map<>
    return Object.fromEntries(this.piles);
  }
  toBSON() {
    return this.toJSON();
  }

  get flatSize(): number {
    let count = 0;
    for (let [key, value] of this.piles.entries()) count += value.size;
    return count;
  }
}
