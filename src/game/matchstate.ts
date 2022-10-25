import cloneDeep from "lodash/cloneDeep";
import * as model from "./model";
import { DrawCardPile } from "./drawcardpile";
import { Match } from "./match";

export class MatchState {
  id: number;
  banks: Array<model.Bank>;
  playArea: model.PlayArea;
  currentPlayerIndex: number;
  drawPile: DrawCardPile;
  discardPile: model.CardPile;

  pendingEffectPointer: model.EffectPointer; // e.g. Kraken, Hook
  addPendingEffect(match: Match) {
    if (this.pendingEffectPointer) {
      throw new Error(
        "Effect already in action: " +
          this.pendingEffectPointer +
          " cannot add next one: " +
          match.lastEvent.eventType
      );
    }

    this.pendingEffectPointer = {
      moveIndex: match.moves.length - 1,
      eventIndex: match.moves.at(-1).getEvents().length - 1,
    };
  }

  static clone(instance: MatchState) {
    //const source = structuredClone(this); // available in node 17, from LT update in 22'Oct
    //const copy = Object.create(Object.getPrototypeOf(source)) as MatchState;
    //const copy = utils.deepCopy<MatchState>(instance);
    const copy = cloneDeep(instance);
    return copy;
  }
}
