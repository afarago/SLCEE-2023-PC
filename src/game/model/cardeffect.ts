/* tslint:disable:max-classes-per-file */
import "core-js/es/array/at";
import { attribute } from "@aws/dynamodb-data-mapper-annotations";
import { embed } from "@aws/dynamodb-data-mapper";

import { Card } from "./model";

export const OCardEffectType = {
  Oracle: "Oracle",
  Hook: "Hook",
  Cannon: "Cannon",
  Sword: "Sword",
  Map: "Map",
};
type CardEffectType = keyof typeof OCardEffectType;

type CardEffectFactoryParemeters = {
  card?: Card;
  cards?: Array<Card>;
};

export type CardEffectResponse = {
  effectType: string; //TODO; use CardEffectType;
  card: {
    suit: string,
    value: number
  };
}

/**
 * Card effect associated with a special card
 */
export class CardEffect {
  @attribute()
  readonly effectType: string; //TODO; use CardEffectType;

  @attribute()
  readonly card: Card;

  @attribute({ memberType: embed(Card)})
  readonly cards: Array<Card>;

  constructor(effectType?: string, params?: CardEffectFactoryParemeters) {
    //TODO: use CardEffectType
    this.effectType = effectType;
    Object.assign(this, params);
  }
}
