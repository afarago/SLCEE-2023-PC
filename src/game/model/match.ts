import "core-js/es/array/at";
import { ObjectId } from "mongodb";

import { SupportsHydration } from "./model";
import MatchEvent from "./matchevent";
import CardEffect from "./cardeffect";
import Player, { PlayerId } from "./player";
import Move from "./move";
import MatchState from "./matchstate";

export type MatchId = ObjectId;

/**
 * Match object, representing the match header
 */
export default class Match implements SupportsHydration {
  populate(pojo: any): any {
    if (pojo.hasOwnProperty("_id")) this._id = new ObjectId(pojo._id);
    if (pojo.hasOwnProperty("players")) this.players = pojo.players = pojo.players;
    if (pojo.hasOwnProperty("move")) this.move = new Move().populate(pojo.move);
    if (pojo.hasOwnProperty("startedAt")) this.startedAt = new Date(pojo.startedAt);
    if (pojo.hasOwnProperty("moveCount")) this.moveCount = pojo.moveCount;
    if (pojo.hasOwnProperty("lastMoveAt")) this.lastMoveAt = new Date(pojo.lastMoveAt);
    if (pojo.hasOwnProperty("currentPlayerId")) this.currentPlayerId = pojo.currentPlayerId;
    return this;
  }

  _id?: MatchId;
  players: PlayerId[];
  //TODO: match do not serialize all items (e.g. _players, )
  //-- do not directly save moves, should be persisted on creation and last on should be retrieved upon db read
  move: Move;

  // @attribute({
  //   //-- when using "S" field - longer, but easier to perceive
  //   marshall: utils.dateMarshall,
  //   unmarshall: utils.dateUnmarshall,
  //   defaultProvider: () => new Date().toISOString(),
  // })
  startedAt!: Date;
  moveCount: number;
  lastMoveAt: Date;
  currentPlayerId?: PlayerId;

  toJSON() {
    let pojo = { ...this };
    delete pojo.move;

    return pojo;
  }
  toBSON() {
    return this.toJSON();
  }

  constructor(players?: Array<PlayerId>) {
    this.players = players ?? [];
  }
  get numberOfPlayers(): number {
    return this.players?.length;
  }
  get state(): MatchState | undefined {
    return this.move?.state;
  }
  get lastEvent(): MatchEvent | undefined {
    return this.move?.lastEvent;
  }
  get pendingEffect(): CardEffect | undefined {
    return this.state?.pendingEffect;
  }
  get isFinished(): boolean | undefined {
    return !this.currentPlayerId;
  }
  public updateHeader() {
    this.moveCount = this.move?.sequenceId;
    this.lastMoveAt = this.move?.at;
    this.currentPlayerId =
      typeof this.move?.currentPlayerIndex == "number"
        ? this.players.at(this.move?.currentPlayerIndex)
        : undefined;
  }
}
