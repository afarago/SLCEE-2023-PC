import 'core-js/es/array/at';

import cloneDeep from 'lodash/cloneDeep';

import { Hydrate } from '../../utils/hydration.util';
import Bank from './bank';
import CardEffect from './cardeffect';
import DiscardCardPile from './discardcardpile';
import DrawCardPile from './drawcardpile';
import { integer } from './model';
import PlayArea from './playarea';

/**
 * Match state associated with an atomic event
 */
export default class State {
  static constructFromObject(data: any, obj?: State) {
    if (data) {
      obj = obj || new State();

      Hydrate.convertFrom(data, 'banks', [Bank], obj);
      Hydrate.convertFrom(data, 'drawPile', DrawCardPile, obj);
      Hydrate.convertFrom(data, 'discardPile', DiscardCardPile, obj);
      Hydrate.convertFrom(data, 'drawPile', DrawCardPile, obj);
      Hydrate.convertFrom(data, 'playArea', PlayArea, obj);
      Hydrate.convertFrom(data, 'currentPlayerIndex', 'Number', obj);
      Hydrate.convertFrom(data, 'pendingEffect', CardEffect, obj);
      Hydrate.convertFrom(data, 'winnerIdx', 'Number', obj);
    }

    return obj;
  }

  banks: Bank[];
  drawPile?: DrawCardPile;
  discardPile?: DiscardCardPile;
  playArea: PlayArea;
  currentPlayerIndex?: integer;
  pendingEffect?: CardEffect; // -- e.g. Hook, Map (not Kraken)
  winnerIdx?: integer;

  clearPendingEffect() {
    delete this.pendingEffect;
  }

  addPendingEffect(effect: CardEffect): void {
    if (this.pendingEffect) {
      throw new Error(
        'Effect already in action: ' + this.pendingEffect.effectType + ' - cannot add next one'
      );
    }

    this.pendingEffect = effect;
  }

  static clone(instance: State) {
    // const source = structuredClone(this); // available in node 17, from LT update in 22'Oct
    // const copy = Object.create(Object.getPrototypeOf(source)) as State;
    // const copy = utils.deepCopy<State>(instance);
    const copy = cloneDeep(instance);
    return copy;
  }
}
