import "core-js/es/array/at";
import { OCardSuit, CardSuit } from "./card";
import Card from "./card";
import FlatCardPile from "./flatcardpile";

/**
 * Discard pile - object to represent discard pile
 */
export default class DiscardCardPile extends FlatCardPile {
  public static create(cards?: Array<Card | any>): DiscardCardPile {
    let retval = new DiscardCardPile();

    if (cards !== undefined) {
      //-- pregenerated debug stack
      retval.populate(cards);
    } else {
      //-- default stack
      for (let s of Object.keys(OCardSuit) as CardSuit[]) {
        for (let cv of [2 /* 3, 4, 5, 6, 7*/]) {
          const cv2 = cv + (s == OCardSuit.Mermaid ? +2 : 0); // as CardValue; //-- for Mermaid shift 2-7 to 4-9
          const card = new Card(s, cv2);
          retval.cards.push(card);
        }
      }
    }

    //-- return generated pile
    return retval;
  }
}
