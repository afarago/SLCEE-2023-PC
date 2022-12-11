/* tslint:disable:max-classes-per-file */
import 'core-js/es/array/at';

import { Hydrate } from '../../utils/hydration.util';
import Card, { CardOrNull } from './card';
import { CardEffectType } from './cardeffect';

export default class CardEffectResponse {
  static constructFromObject(data: any, obj?: CardEffectResponse) {
    if (data) {
      obj = obj || new CardEffectResponse(data.effectType);

      Hydrate.convertFrom(data, 'effectType', 'CardEffectType', obj);
      Hydrate.convertFrom(data, 'card', Card, obj);
    }
    return obj;
  }

  constructor(public effectType: CardEffectType, public card?: CardOrNull) {}
}
