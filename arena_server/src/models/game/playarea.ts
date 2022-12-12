import FlatCardPile from './flatcardpile';
import Card from './card';

/**
 * Play area - object to represent the play area
 */
export default class PlayArea extends FlatCardPile {
  static override constructFromObject(data: any, obj?: PlayArea) {
    if (data) {
      obj = obj || new PlayArea();
      FlatCardPile.constructFromObject(data, obj);
    }
    return obj;
  }

  public static create(cards?: (Card | any)[]): PlayArea {
    const retval = new PlayArea();
    if (cards) PlayArea.constructFromObject(cards, retval);

    return retval;
  }
}
