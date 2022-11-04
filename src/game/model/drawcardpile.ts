import "core-js/es/array/at";
import Card, { OCardSuit, CardSuit } from "./card";
import CardPile from "./cardpile";

/**
 * Draw card pile - contains all remining cards
 */
export default class DrawCardPile extends CardPile {
  populate(pojo: any) {
    super.populate(pojo);
    if (pojo.hasOwnProperty("nextCard")) this.nextCard = new Card().populate(pojo.nextCard);
    return this;
  }

  public nextCard?: Card; //-- Oracle reveals Next Card

  public static create(cards?: Array<Card | any>): DrawCardPile {
    let retval = new DrawCardPile();

    if (cards !== undefined) {
      //-- pregenerated debug stack
      retval.populate(cards);
    } else {
      //-- default stack
      const tempcards = new Array<Card>();
      for (let s of Object.keys(OCardSuit) as CardSuit[]) {
        for (let cv of [/*2, */ 3, 4, 5, 6, 7]) {
          const cv2 = cv + (s == OCardSuit.Mermaid ? +2 : 0); // as CardValue; //-- for Mermaid shift 2-7 to 4-9
          const card = new Card(s, cv2);
          tempcards.push(card);
        }
      }

      //-- randomize cards, preordering them
      while (tempcards.length) {
        const pickedCardIdx = Math.floor(Math.random() * tempcards.length); //TODO: add pseudorandom
        const pickedCard = tempcards.splice(pickedCardIdx, 1).at(0);
        retval.cards.push(pickedCard);
      }
    }

    //-- return generated pile
    return retval;
  }

  public draw(doRemoveFromPile: boolean = true): Card | undefined {
    let pickedCardindex = -1;

    //-- check if pending (peeked card) draw due to oracle
    if (this.nextCard) {
      let pickedCardindex = this.cards.findIndex(
        (c) => c.suit === this.nextCard?.suit && c.value === this.nextCard?.value
      );

      delete this.nextCard; //-- reset peeked card

      //-- we need to remove the card from the pile as well - as peeking does not remove it
      let pickedCard = this.cards.splice(pickedCardindex, 1)?.at(0);
      return pickedCard;
    }

    //-- use next card
    return doRemoveFromPile ? this.cards.splice(0, 1)?.at(0) : this?.cards.at(0);
  }
} // or Map<Suit, number>; -- but how to do random?
