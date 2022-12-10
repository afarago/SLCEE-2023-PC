import CardPile from './cardpile';

/**
 * FlatCardPile - with no properties
 */
export default class FlatCardPile extends CardPile {
  // -- override toJSON
  // -- architectural: it is ok from architectural prespective as de do not have any other subproperties
  toJSON() {
    return this.cards;
  }
  toBSON() {
    return this.toJSON();
  }
}
