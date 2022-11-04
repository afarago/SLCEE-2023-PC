import "core-js/es/array/at";
import cloneDeep from "lodash/cloneDeep";

import { SupportsHydration } from "./model";
import Bank from "./bank";
import PlayArea from "./playarea";
import DrawCardPile from "./drawcardpile";
import CardEffect from "./cardeffect";
import DiscardCardPile from "./discardcardpile";

/**
 * Match state associated with an atomic event
 */
export default class MatchState implements SupportsHydration {
  populate(pojo: any) {
    if (pojo.hasOwnProperty("banks"))
      this.banks = pojo.banks?.map((pojoiter: any) => new Bank().populate(pojoiter));
    if (pojo.hasOwnProperty("playArea")) this.playArea = new PlayArea().populate(pojo.playArea);
    if (pojo.hasOwnProperty("currentPlayerIndex"))
      this.currentPlayerIndex = pojo.currentPlayerIndex;
    if (pojo.hasOwnProperty("drawPile")) this.drawPile = new DrawCardPile().populate(pojo.drawPile);
    if (pojo.hasOwnProperty("discardPile"))
      this.discardPile = new DiscardCardPile().populate(pojo.discardPile);
    if (pojo.hasOwnProperty("pendingEffect"))
      this.pendingEffect = new CardEffect().populate(pojo.pendingEffect);
    return this;
  }

  banks: Array<Bank>;
  playArea: PlayArea;
  currentPlayerIndex: number;
  drawPile: DrawCardPile;
  discardPile: DiscardCardPile;
  pendingEffect?: CardEffect; //-- e.g. Hook, Map (not Kraken)
  pendingKrakenCards?: number; //-- no need to persist, only applies to the specific move

  clearPendingEffect() {
    delete this.pendingEffect;
  }

  addPendingEffect(effect: CardEffect): void {
    if (this.pendingEffect) {
      throw new Error(
        "Effect already in action: " + this.pendingEffect.effectType + " - cannot add next one"
      );
    }

    this.pendingEffect = effect;
  }

  static clone(instance: MatchState) {
    //const source = structuredClone(this); // available in node 17, from LT update in 22'Oct
    //const copy = Object.create(Object.getPrototypeOf(source)) as MatchState;
    //const copy = utils.deepCopy<MatchState>(instance);
    const copy = cloneDeep(instance);
    return copy;
  }
}
