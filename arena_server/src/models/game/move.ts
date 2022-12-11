import 'core-js/es/array/at';

import { ObjectId } from 'mongodb';

import { Hydrate } from '../../utils/hydration.util';
import { MatchId } from './match';
import MatchEvent from './matchevent';
import State from './state';
import UserAction from './useraction';

export type MoveId = ObjectId;

export interface IMoveSequence {
  sequenceId: number;
  turnId: number;
  sequenceInTurnId: number;
}
export interface IMoveAt {
  at: Date;
}

export interface IMoveEvents {
  events: MatchEvent[];
}

export interface IMoveSource {
  userAction?: UserAction;
  clientIP?: string;
}
export interface IMoveEvents {
  events: MatchEvent[];
}

export interface IMove extends IMoveAt, IMoveSequence, IMoveSource, IMoveEvents {}

/**
 * Move object - encapsulating multiple events
 */
export default class Move implements IMove {
  static constructFromObject(data: any, obj?: Move) {
    if (data) {
      obj = obj || new Move();

      Hydrate.convertFrom(data, '_id', ObjectId, obj);
      Hydrate.convertFrom(data, 'matchId', ObjectId, obj);
      Hydrate.convertFrom(data, 'sequenceId', 'Number', obj);
      Hydrate.convertFrom(data, 'sequenceInTurnId', 'Number', obj);
      Hydrate.convertFrom(data, 'turnId', 'Number', obj);
      Hydrate.convertFrom(data, 'at', Date, obj);
      Hydrate.convertFrom(data, 'events', [MatchEvent], obj);
      Hydrate.convertFrom(data, 'userAction', UserAction, obj);
      Hydrate.convertFrom(data, 'clientIP', 'String', obj);
    }

    return obj;
  }

  // -- internals for db
  _id: MoveId;
  matchId: MatchId; // -- parent matchid

  // -- IMoveSequence
  sequenceId: number;
  sequenceInTurnId: number;
  turnId: number;
  // -- IMoveAt
  at: Date;

  // -- stored, not delivered
  events: MatchEvent[] = [];
  userAction?: UserAction;
  clientIP?: string;

  // -- not stored, not delivered
  stateCache?: State; // -- not stored in db

  toJSON() {
    const pojo: any = { ...this };

    // -- stateCache is not stored in db
    delete pojo.stateCache;

    // TODO: no need to store event.state's, consider storing top level state only

    return pojo;
  }
  toBSON() {
    return this.toJSON();
  }

  constructor(matchId?: MatchId, initialState?: State) {
    if (!!matchId) this.matchId = matchId;
    this.stateCache = initialState;
  }

  get state(): State | undefined {
    return this.lastEvent ? this.lastEvent?.state : this.stateCache;
  }
  get lastEvent(): MatchEvent | undefined {
    return this.events?.at(-1);
  }
  get currentPlayerIndex(): number | null {
    return this.state ? this.state.currentPlayerIndex : null;
  }
  getEvents(): MatchEvent[] {
    return this.events;
  }
  addEvent(event: MatchEvent): void {
    this.events?.push(event);
  }
}
