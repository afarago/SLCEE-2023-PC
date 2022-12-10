import FlatCardPile from './flatcardpile';

/**
 * Play area - object to represent the play area
 */
export default class PlayArea extends FlatCardPile {
  static constructFromObject(data: any, obj?: PlayArea): PlayArea {
    if (data) {
      obj = obj || new PlayArea();
      FlatCardPile.constructFromObject(data, obj);
    }
    return obj;
  }
} // or Map<Suit, number>;
