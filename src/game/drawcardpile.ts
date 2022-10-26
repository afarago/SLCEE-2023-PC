import "core-js/es/array/at";
import {
  Card,
  CardAbbreviation,
  CardValue,
  CardValueBase,
  CardPile,
  OCardSuit,
  CardSuit,
} from "./model";

export class DrawCardPile extends CardPile {
  nextCard: Card; //-- Oracle reveals Next Card
  isPreOrdered: boolean; //-- debug purposes preset order, without random draw

  public static create(): DrawCardPile;
  public static create(cards: Array<Card | CardAbbreviation>): DrawCardPile;
  public static create(suits: Array<CardSuit>, values: Array<CardValue>): DrawCardPile;
  public static create(cardsOrSuits?: Array<any>, values?: Array<CardValue>): DrawCardPile {
    let retval = new DrawCardPile();

    if (cardsOrSuits instanceof Array) {
      //-- list of cards or card abbreviations
      cardsOrSuits.forEach((card) => {
        if (card instanceof Card) retval.cards.push(card);
        else if (card instanceof Array)
          retval.cards.push(Card.fromAbbreviation(card as CardAbbreviation));
      });
      retval.isPreOrdered = true;
    }
    if (retval.cards.length == 0) {
      //-- default stack or generated suit/values
      retval.isPreOrdered = false;
      if (!cardsOrSuits) {
        cardsOrSuits = Object.keys(OCardSuit) as CardSuit[]; //-- empty suits --> use all suits
        if (!values) values = [2, 3, 4, 5, 6, 7]; //-- empty values --> use default 2-7 values
      }

      //-- generate cards
      for (let s of cardsOrSuits) {
        for (let cv of values) {
          const cv2 = (cv + (s == "Mermaid" ? +2 : 0)) as CardValue; //-- for Mermaid shift 2-7 to 4-9
          const card = new Card(s, cv2);
          retval.cards.push(card);
        }
      }
    }

    //-- return generated pile
    return retval;
  }

  draw(doRemoveFromPile: boolean = true): Card {
    //-- check if pending (peeked card) draw due to oracle
    if (this.nextCard) {
      const pickedCard = this.nextCard;
      this.nextCard = null; //-- reset peeked card
      return pickedCard;
    }

    //-- if this is preordered, use next card
    if (this.isPreOrdered) return doRemoveFromPile ? this.cards.splice(0, 1)?.at(0) : this?.cards.at(0);

    //-- default case - pick a random card
    //-- execute the draw
    let pickedCardindex = Math.floor(Math.random() * this.cards.length);
    return doRemoveFromPile ? this.cards.splice(pickedCardindex, 1)?.at(0) : this?.cards.at(pickedCardindex);
  }
} // or Map<Suit, number>; -- but how to do random?
