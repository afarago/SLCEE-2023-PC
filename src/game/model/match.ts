import "core-js/es/array/at";
import {
  attribute,
  hashKey,
  autoGeneratedHashKey,
  rangeKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";

import { CardEffect, MatchEvent, OMatchEventType } from "./model";
import Player, { PlayerId } from "./player";
import Move from "./move";
import MatchState from "./matchstate";

export type MatchId = string;

/**
 * Match object, representing the match header
 */
@table("Matches")
export default class Match {
  @autoGeneratedHashKey()
  id?: MatchId;

  @attribute()
  players: PlayerId[];

  //-- do not directly save moves, should be persisted on creation and last on should be retrieved upon db read
  move: Move;

  // @attribute({
  //   //-- when using "S" field - longer, but easier to perceive
  //   marshall: utils.dateMarshall,
  //   unmarshall: utils.dateUnmarshall,
  //   defaultProvider: () => new Date().toISOString(),
  // })
  @rangeKey({
    //-- when using "N" field
    type: "Date",
    defaultProvider: () => new Date(),
  })
  startedAt!: Date;

  @attribute()
  moveCount: number;

  @attribute({ type: "Date" })
  lastMoveAt: Date;

  @attribute()
  currentPlayerId: PlayerId;
  //(isFinished)

  constructor(players?: Array<PlayerId>) {
    this.players = players;
  }
  get numberOfPlayers(): number {
    return this.players?.length;
  }
  get state(): MatchState {
    return this.move?.state;
  }
  get lastEvent(): MatchEvent {
    return this.move?.lastEvent;
  }
  get pendingEffect(): CardEffect {
    return this.state?.pendingEffect;
  }
  get isFinished(): boolean {
    return !((this.move && this.move?.currentPlayerIndex >= 0) || !!this.currentPlayerId);
  }
  public updateHeader() {
    this.moveCount = this.move?.sequenceId;
    this.lastMoveAt = this.move?.at;
    this.currentPlayerId = this.players[this.move?.currentPlayerIndex];
    //return this.players[this.move?.currentPlayerIndex];
  }
}