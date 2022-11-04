/* tslint:disable:max-classes-per-file */
import "core-js/es/array/at";
import { SupportsHydration } from "./model";
import Card from "./card";

export const OCardEffectType = {
  Oracle: "Oracle",
  Hook: "Hook",
  Cannon: "Cannon",
  Sword: "Sword",
  Map: "Map",
};
export type CardEffectType = keyof typeof OCardEffectType;

type CardEffectFactoryParemeters = {
  card?: Card;
  cards?: Array<Card>;
};

export type CardEffectResponse = {
  effectType: string; //TODO; use CardEffectType;
  card: {
    suit: string;
    value: number;
  };
};

/**
 * Card effect associated with a special card
 */
export default class CardEffect implements SupportsHydration {
  populate(pojo: any) {
    if (pojo.hasOwnProperty("effectType")) this.effectType = pojo.effectType;
    if (pojo.hasOwnProperty("card")) this.card = new Card().populate(pojo.card);
    if (pojo.hasOwnProperty("cards"))
      this.cards = pojo.cards?.map((pojoitem: any) => new Card().populate(pojoitem));

    return this;
  }

  public effectType?: string; //TODO; use CardEffectType;
  public card: Card;
  public cards: Array<Card>;

  constructor(effectType?: string, params?: CardEffectFactoryParemeters) {
    //TODO: use CardEffectType
    this.effectType = effectType;
    Object.assign(this, params);
  }
}
