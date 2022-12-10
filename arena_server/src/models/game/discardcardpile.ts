import 'core-js/es/array/at';

import Card, { CardSuit, CardValue, OCardSuit } from './card';
import FlatCardPile from './flatcardpile';

/**
 * Discard pile - object to represent discard pile
 */
export default class DiscardCardPile extends FlatCardPile {
  static constructFromObject(data: any, obj?: DiscardCardPile) {
    if (data) {
      obj = obj || new DiscardCardPile();
      FlatCardPile.constructFromObject(data, obj);
    }
    return obj;
  }

  public static create(cards?: (Card | any)[]): DiscardCardPile {
    const retval = new DiscardCardPile();

    if (cards !== undefined) {
      // -- using debug stack
      DiscardCardPile.constructFromObject(cards, retval);
    } else {
      // -- default stack
      for (const s of Object.keys(OCardSuit) as CardSuit[]) {
        for (const cv of [2 /* 3, 4, 5, 6, 7*/]) {
          const cv2 = cv + (s === OCardSuit.Mermaid ? +2 : 0); // as CardValue; //-- for Mermaid shift 2-7 to 4-9
          const card = new Card(s, cv2 as CardValue);
          retval.cards.push(card);
        }
      }
    }

    // -- return generated pile
    return retval;
  }
}
