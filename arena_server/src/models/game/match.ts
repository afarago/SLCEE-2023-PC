import 'core-js/es/array/at';

import { ObjectId } from 'mongodb';

import { Hydrate } from '../../utils/hydration.util';
import CardEffect from './cardeffect';
import MatchCreationParams from './matchcreationparams';
import MatchEvent from './matchevent';
import { integer } from './model';
import Move from './move';
import { PlayerId } from './player';
import State from './state';

export type MatchId = ObjectId;

export interface IMatchCoreReadonly {
  _id: MatchId;
  playerids: PlayerId[];
  startedAt: Date;
  createdByPlayerId?: PlayerId | null; // -- null for admin, otherwise player id
  creationParams?: MatchCreationParams;
}
export interface IMatchCoreChanging {
  lastMoveAt: Date;
  moveCount: integer;
  turnCount: integer;
  moveCountInTurn: integer | null;
  state?: State;
  stateAtTurnStart?: State;
  currentPlayerIndex: integer | null;
  currentPlayerId: PlayerId | null;
}
export interface IMatchCore extends IMatchCoreReadonly, IMatchCoreChanging {}

/**
 * Match object, representing the match header
 */
export default class Match implements IMatchCore {
  static constructFromObject(data: any, obj?: Match) {
    if (data) {
      obj = obj || new Match();

      Hydrate.convertFrom(data, '_id', ObjectId, obj);
      Hydrate.convertFrom(data, 'playerids', [ObjectId], obj);
      Hydrate.convertFrom(data, 'startedAt', Date, obj);
      Hydrate.convertFrom(data, 'createdByPlayerId', ObjectId, obj);
      Hydrate.convertFrom(data, 'creationParams', MatchCreationParams, obj);

      Hydrate.convertFrom(data, 'lastMoveAt', Date, obj);
      Hydrate.convertFrom(data, 'moveCount', 'Number', obj);
      Hydrate.convertFrom(data, 'turnCount', 'Number', obj);
      Hydrate.convertFrom(data, 'moveCountInTurn', 'Number', obj);
      Hydrate.convertFrom(data, 'state', State, obj, 'stateCache');
      Hydrate.convertFrom(data, 'stateAtTurnStart', State, obj);
      Hydrate.convertFrom(data, 'currentPlayerIndex', 'Number', obj, 'currentPlayerIndex');
      Hydrate.convertFrom(data, 'currentPlayerId', ObjectId, obj, 'currentPlayerId');
    }
    return obj;
  }

  _id: MatchId;
  playerids: PlayerId[];
  startedAt: Date;
  createdByPlayerId?: PlayerId | null; // -- null for admin, otherwise player id
  creationParams?: MatchCreationParams;

  lastMoveAt: Date;
  moveCount: integer;
  turnCount: integer;
  moveCountInTurn: integer | null;
  stateCache?: State; // -- backup field, to cache value for db as 'state'
  stateAtTurnStart: State; // -- state at turn start
  currentPlayerIndex: number | null;
  currentPlayerId: PlayerId | null; // -- only for db search, do not return anywhere else

  move?: Move; // -- do not directly save moves, should be persisted on creation and last on should be retrieved upon db read

  toJSON(): IMatchCore {
    const pojo: any = { ...this };
    delete pojo.move; // do not directly save moves, should be persisted on creation and last on should be retrieved upon db read

    // -- stateCache is stored as state in the db
    pojo.state = { ...this.stateCache };
    delete pojo.stateCache;

    return pojo;
  }
  toBSON() {
    return this.toJSON();
  }

  constructor(createdByPlayerId?: PlayerId | null, playerids?: PlayerId[], creationParams?: MatchCreationParams) {
    this.playerids = playerids ?? [];
    this.createdByPlayerId = createdByPlayerId;
    this.creationParams = creationParams;
  }
  get numberOfPlayers(): number {
    return this.playerids?.length;
  }
  getCurrentPlayerId(): PlayerId | null {
    return this.move
      ? this.getCurrentPlayerIdFromMove() // -- after matchEnd this will be null
      : this.state && this.state.currentPlayerIndex !== null
      ? this.playerids[this.state.currentPlayerIndex]
      : null;
  }
  getActivePlayerIdx(): number | null {
    // -- if moveCountInTurn is nulled, it means that we are waiting for the move of the next player
    return this.state && this.state.currentPlayerIndex !== null // -- match has not finished
      ? (this.state.currentPlayerIndex + (this.moveCountInTurn !== null ? 0 : +1)) % this.numberOfPlayers
      : null;
  }
  getActivePlayerId(): PlayerId | null {
    if (this.getActivePlayerIdx() === null) return null;
    else return this.getPlayerIdAt(this.getActivePlayerIdx());
  }
  getCurrentPlayerIdFromMove(): PlayerId | null {
    return this.move ? this.getPlayerIdAt(this.move?.currentPlayerIndex) : this.getCurrentPlayerId();
  }
  getCurrentPlayerIdxFromMove(): number | undefined | null {
    return this.move ? this.move.currentPlayerIndex : undefined;
  }
  getPlayerIdAt(idx: any): PlayerId | null {
    return Number.isFinite(idx) ? this.playerids.at(idx) ?? null : null;
  }
  // getNextPlayerId(): PlayerId {
  //   const currentPlayerIndex = !this.isFinished
  //     ? (this.getCurrentPlayerIdxFromMove() + (!!this.moveCountInTurn ? 0 : +1)) % this.numberOfPlayers
  //     : undefined;

  //   return Number.isFinite(currentPlayerIndex) ? this.getPlayerIdAt(currentPlayerIndex) : undefined;
  // }
  get state(): State | undefined {
    return this.move ? this.move?.state : this.stateCache;
  }
  get lastEvent(): MatchEvent | undefined {
    return this.move?.lastEvent;
  }
  get pendingEffect(): CardEffect | undefined {
    return this.state?.pendingEffect;
  }
  get isFinished(): boolean {
    return !this.getCurrentPlayerId();
  }
}
