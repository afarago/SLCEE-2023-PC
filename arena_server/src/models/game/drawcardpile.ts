import 'core-js/es/array/at';

import RandomService from '../../utils/random';
import Card, { CardSuit, CardValue, OCardSuit } from './card';
import FlatCardPile from './flatcardpile';

/**
 * Draw card pile - contains all remining cards
 */
export default class DrawCardPile extends FlatCardPile {
  static constructFromObject(data: any, obj?: DrawCardPile) {
    if (data) {
      obj = obj || new DrawCardPile();
      FlatCardPile.constructFromObject(data, obj);
    }
    return obj;
  }

  public static create(cards: (Card | any)[], randomService: RandomService): DrawCardPile {
    const retval = new DrawCardPile();

    if (cards !== undefined) {
      // -- using debug stack
      DrawCardPile.constructFromObject(cards, retval);
    } else {
      // -- default stack
      const tempcards = new Array<Card>();
      for (const s of Object.keys(OCardSuit) as CardSuit[]) {
        for (const cv of [/*2, */ 3, 4, 5, 6, 7]) {
          const cv2 = cv + (s === OCardSuit.Mermaid ? +2 : 0); // as CardValue; //-- for Mermaid shift 2-7 to 4-9
          const card = new Card(s, cv2 as CardValue);
          tempcards.push(card);
        }
      }

      // -- randomize cards, preordering them
      while (tempcards.length) {
        const pickedCardIdx = randomService.getRandom(tempcards.length);
        const pickedCard = tempcards.splice(pickedCardIdx, 1).at(0);
        retval.cards.push(pickedCard);
      }
    }

    // -- return generated pile
    return retval;
  }

  public draw(doRemoveFromPile: boolean = true): Card | undefined {
    // -- use next card
    return doRemoveFromPile ? this.cards.splice(0, 1)?.at(0) : this?.cards.at(0);
  }
} // or Map<Suit, number>; -- but how to do random?
