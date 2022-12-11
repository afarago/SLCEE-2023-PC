/* tslint:disable:max-classes-per-file */
import 'core-js/es/array/at';

import { Hydrate } from '../../utils/hydration.util';
import Card from './card';
import { OCardSuit } from './card';

export const OCardEffectType = {
  Oracle: OCardSuit.Oracle as CardEffectType,
  Hook: OCardSuit.Hook as CardEffectType,
  Cannon: OCardSuit.Cannon as CardEffectType,
  Sword: OCardSuit.Sword as CardEffectType,
  Map: OCardSuit.Map as CardEffectType,
  Kraken: OCardSuit.Kraken as CardEffectType,
};
// export type CardEffectType = keyof typeof OCardEffectType; //TODO: resolve circularity
export type CardEffectType = 'Oracle' | 'Hook' | 'Cannon' | 'Sword' | 'Map' | 'Kraken';

/**
 * Card effect associated with a special card
 */
export default class CardEffect {
  static constructFromObject(data: any, obj?: CardEffect) {
    if (data) {
      obj = obj || new CardEffect(data.effectType);

      Hydrate.convertFrom(data, 'effectType', 'CardEffectType', obj);
      Hydrate.convertFrom(data, 'cards', [Card], obj);
      Hydrate.convertFrom(data, 'krakenCount', 'Number', obj);
    }
    return obj;
  }

  constructor(public effectType: CardEffectType, public cards?: (Card | null)[], public krakenCount?: number) {
    if (effectType) this.effectType = effectType;
    if (cards) this.cards = cards;
    if (krakenCount) this.krakenCount = krakenCount;
  }
}
