import "core-js/es/array/at";
import { ObjectId } from "mongodb";

import { SupportsHydration } from "./model";
import MatchState from "./matchstate";
import MatchEvent from "./matchevent";
import Match, { MatchId } from "./match";

export type MoveId = ObjectId;

/**
 * Move object - encapsulating multiple events
 */
export default class Move implements SupportsHydration {
  populate(pojo: any) {
    if (pojo.hasOwnProperty("_id")) this._id = new ObjectId(pojo._id);
    if (pojo.hasOwnProperty("matchId")) this.matchId = pojo.matchId;
    if (pojo.hasOwnProperty("sequenceId")) this.sequenceId = pojo.sequenceId;
    if (pojo.hasOwnProperty("at")) this.at = new Date(pojo.at);
    if (pojo.hasOwnProperty("events"))
      this.events = pojo.events.map((pojoiter: any) => new MatchEvent().populate(pojoiter));
    return this;
  }

  _id!: MoveId;
  matchId?: MatchId; //-- parent matchid
  sequenceId: number;

  // @attribute({
  //   marshall: utils.dateMarshall,
  //   unmarshall: utils.dateUnmarshall,
  //   defaultProvider: () => new Date().toISOString(),
  // })
  at!: Date;
  events: Array<MatchEvent> = [];

  toJSON() {
    let pojo = { ...this };
    delete pojo.initialState;

    return pojo;
  }
  toBSON() {
    return this.toJSON();
  }

  //-- do not persist, this is the initial state for handling events
  //-- when new move is created, before first event is added
  initialState?: MatchState;

  constructor(matchId?: MatchId, initialState?: MatchState) {
    this.matchId = matchId;
    this.initialState = initialState;
  }

  get state(): MatchState | undefined {
    return this.lastEvent?.state ?? this.initialState;
  }
  get lastEvent(): MatchEvent | undefined {
    return this.events?.at(-1);
  }
  get currentPlayerIndex(): number | undefined {
    return this.state?.currentPlayerIndex;
  }
  getEvents(): Array<MatchEvent> {
    return this.events;
  }
  addEvent(event: MatchEvent): void {
    this.events?.push(event);
  }
}
