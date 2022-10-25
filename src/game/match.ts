import 'core-js/features/array/at';

import * as model from "./model";
import * as matchevent from "./matchevent";
import { Move } from "./move";
import { MatchState } from "./matchstate";
import { DrawCardPile } from "./drawcardpile";

export class Match {
  id: model.MatchId;
  players: model.PlayerId[];
  moves: Array<Move>;
  numberOfPlayers: number = 2;

  constructor(id: model.MatchId, players: Array<model.PlayerId>) {
    this.id = id;
    this.players = players;
  }
  get startedAt(): Date {
    return this.moves.at(0)?.at;
  }
  get state(): MatchState {
    //-- it might happen that this ha sno state, check for the previous one
    return this.lastMove?.state ?? this.moves.at(-2)?.state; //TO-CHECK, -2 is really needed?
    //TODO: consider move having a state at the very beginning...
  }
  get lastEvent(): matchevent.MatchEventBase {
    return this.lastMove.lastEvent;
  }
  get lastMove(): Move {
    return this.moves.at(-1);
  }
  get currentPlayer(): model.PlayerId {
    return this.players[this.lastMove?.currentPlayerIndex];
  }
  get pendingEffect(): matchevent.CardEffectBase {
    const pendingEffectPointer = this.state?.pendingEffectPointer;
    if (!pendingEffectPointer) return;

    const pendingEffectContainer = this.moves
      .at(pendingEffectPointer.moveIndex)
      .getEvents()
      .at(pendingEffectPointer.eventIndex);

    if (!(pendingEffectContainer instanceof matchevent.CardPlayedEffect)) return;

    const pendingEffect = (pendingEffectContainer as matchevent.CardPlayedEffect).effect;

    return pendingEffect;
  }
}
