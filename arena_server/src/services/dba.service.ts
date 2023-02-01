import 'reflect-metadata';

import { ObjectId } from 'mongodb';
import { EventEmitter } from 'node:events';
import { Service } from 'typedi';
import * as util from 'util';

import Logger from '../config/logger';
import Match, { IMatchCoreChangingDb } from '../models/game/match';
import Move from '../models/game/move';
import Player from '../models/game/player';
import State from '../models/game/state';
import DbService from './db.service';

/**
 * Stringified Object Id.
 * @pattern [0-9a-f]{24}|[0-9a-f]{12}
 * @format ObjectId
 * @example "30d2b1b242ea506dcc6504de"
 */
export type ObjectIdString = string;

@Service()
export default class DBAService {
  constructor(private dbService: DbService) {
    this.dbService.onCollectionChanged.on(
      'change',
      async (collection: string, documentKey: string, operationType: string, item: any) =>
        await this.handleDbCollectionChange(collection, documentKey, operationType, item)
    );
  }

  /**
   * Returns Gets all matches
   * @param options  filter user id, active/current user id, date day, tags
   * @returns matches promise
   */
  async getMatchesPromise(options: {
    id?: ObjectIdString[];
    playerId?: ObjectIdString;
    activePlayerId?: ObjectIdString;
    date?: Date;
    tags?: string[];
    limit?: {
      offset?: ObjectIdString;
      count: number;
    };
    sortAscending?: boolean;
    checkNotFinished?: boolean;
    checkTimeoutExpired?: boolean;
  }): Promise<Match[]> {
    let filterOption = {
      ...(options?.id
        ? {
            _id: { $in: options.id.map((id) => new ObjectId(id)) },
          }
        : {}),
      ...(options?.playerId
        ? {
            playerids: new ObjectId(options.playerId),
          }
        : {}),
      ...(options?.activePlayerId
        ? {
            activePlayerIdCached: new ObjectId(options.activePlayerId),
          }
        : {}),
      ...(options?.tags
        ? {
            'creationParams.tags': { $in: options.tags },
          }
        : {}),
      ...(options?.limit?.offset
        ? {
            _id: options?.sortAscending
              ? { $gt: new ObjectId(options.limit.offset) }
              : { $lt: new ObjectId(options.limit.offset) },
          }
        : {}),
      ...(options?.checkNotFinished
        ? {
            currentPlayerIndex: { $ne: null },
          }
        : {}),
      ...(options?.checkTimeoutExpired
        ? {
            'creationParams.timeout': { $exists: true },
            $expr: {
              $lt: [
                '$lastMoveAt',
                {
                  $dateSubtract: {
                    startDate: '$$NOW',
                    unit: 'second',
                    amount: '$creationParams.timeout',
                  },
                },
              ],
            },
          }
        : {}),
    };
    if (options?.date) {
      const filterToday1 = new Date(options.date);
      filterToday1.setHours(0, 0, 0, 0);
      const filterToday2 = new Date(filterToday1);
      filterToday2.setDate(filterToday2.getDate() + 1);
      filterOption = {
        ...filterOption,
        ...{
          startedAt: { $gte: filterToday1, $lte: filterToday2 },
        },
      };
    }

    await this.dbService.ensureConnected();
    const matchesCursor = this.dbService.collections.matches
      ?.find(filterOption)
      .sort({ startedAt: options.sortAscending ? +1 : -1 })
      // -- A limit() value of 0 (i.e. .limit(0)) is equivalent to setting no limit.
      // -- By passing a negative limit, the client indicates to the server that it will not ask for a subsequent batch via getMore
      .limit((options?.limit?.count ?? 0) > 0 ? -((options?.limit?.count ?? 0) + 1) : 0);
    const dbitems = await matchesCursor?.toArray();

    const results =
      dbitems?.reduce((acc, pojo: any) => {
        try {
          const item = Match.constructFromObject(pojo);
          if (!!item) acc.push(item);
        } catch {
          Logger.error(`Invalid object: ${util.inspect(pojo)}`);
        }
        return acc;
      }, new Array<Match>()) ?? [];
    return results;
  }

  /**
   * Gets match by id
   * @param id
   * @returns match by id promise
   */
  async getMatchByIdPromise(id: ObjectIdString): Promise<Match | undefined> {
    await this.dbService.ensureConnected();
    const dbitem = await this.dbService.collections.matches?.findOne({ _id: new ObjectId(id) });
    if (!dbitem) return undefined;

    const result = Match.constructFromObject(dbitem);
    return result;
  }

  /**
   * Gets a player by id
   * @param id
   * @returns player by id promise
   */
  async getPlayerByIdPromise(id: ObjectIdString): Promise<Player | undefined> {
    // if (!doAllowCachedResponse) {
    //   //-- normal Db retrieval
    //   await this.dbService.ensureConnected();
    //   const dbitem = await this.dbService?.collections.players?.findOne({ _id: new ObjectId(id) });
    //   if (!dbitem) return undefined;
    //   const result = Player.constructFromObject(dbitem);
    //   return result;
    // } else {
    // -- return from the cache
    const playerCache = await this.getPlayersPromise();
    return playerCache.get(id);
    // }
  }

  /**
   * Gets players by ids
   * @param ids
   * @returns players by ids promise
   */
  async getPlayerByIdsPromise(ids: ObjectIdString[]): Promise<Player[]> {
    // if (!doAllowCachedResponse) {
    //   const oids = ids?.map((id) => new ObjectId(id));
    //   await this.dbService.ensureConnected();
    //   const dbitems = await this.dbService?.collections.players?.find({ _id: { $in: oids } }).toArray();
    //   if (!dbitems) throw new Error('Error retrieving players');

    //   const result: Player[] = ids?.map((id) => {
    //     const dbitem = dbitems?.find((item: any) => item._id?.equals(id));
    //     const player = Player.constructFromObject(dbitem);
    //     if (player) return player;
    //     throw new Error(`Player ${id} is not valid.`);
    //   });

    //   return result;
    // } else {
    // -- return from the cache
    const playerCache = await this.getPlayersPromise();
    return ids?.map((pid) => {
      const pobj = playerCache.get(pid);
      if (!pobj) throw new Error(`Player ${pid} is not valid.`);
      return pobj;
    });
    // }
  }

  /**
   * Gets players
   * @returns players promise
   */
  async getPlayersPromise(): Promise<Map<ObjectIdString, Player>> {
    if (!this.playersCache) {
      await this.dbService.ensureConnected();
      const dbitems = await this.dbService?.collections.players?.find({}).toArray();

      const results =
        dbitems?.reduce((acc, pojo: any) => {
          try {
            const item = Player.constructFromObject(pojo);
            if (!!item) acc.push(item);
          } catch {
            Logger.error(`Invalid object: ${util.inspect(pojo)}`);
          }
          return acc;
        }, new Array<Player>()) ?? [];
      this.playersCache = results?.reduce(
        (prev, current) => prev.set(current._id.toString(), current),
        new Map<string, Player>()
      );
    }

    // -- return from the cache
    return this.playersCache; // -- avoid im-possible circular loop await this.getPlayersCachePromise();
  }

  /**
   * Gets last move by match id
   * @param matchId
   * @returns last move by match id promise
   */
  async getLastMoveByMatchIdPromise(matchId: ObjectIdString): Promise<Move | undefined> {
    await this.dbService.ensureConnected();
    const matchIdObj = new ObjectId(matchId);
    const dbitem = await this.dbService?.collections.moves?.findOne(
      { matchId: matchIdObj },
      {
        // limit: 1,
        sort: { sequenceId: -1 },
      }
    );
    if (!dbitem) throw new Error(`Error retrieving move by match id ${matchId}.`);

    const result = Move.constructFromObject(dbitem);
    return result;
  }

  /**
   * Gets all moves by match id
   * @param matchId
   * @returns all moves by match id promise
   */
  async getAllMovesByMatchIdPromise(matchId: ObjectIdString): Promise<Move[]> {
    const matchIdObj = new ObjectId(matchId);
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService?.collections.moves
      ?.find({ matchId: matchIdObj })
      .sort({ sequenceId: +1 })
      .toArray();
    if (!dbitems) throw new Error('Error retrieving moves');

    const results =
      dbitems?.reduce((acc, pojo: any) => {
        try {
          const item = Move.constructFromObject(pojo);
          if (!!item) acc.push(item);
        } catch {
          Logger.error(`Invalid object: ${util.inspect(pojo)}`);
        }
        return acc;
      }, new Array<Move>()) ?? [];
    return results;
  }

  /**
   * Updates match and creates a move in transaction
   * @param match
   * @param move
   * @param originalMoveAt safeguarding that we still update the original match record and there is no concurrent access
   * @returns match and create move promise
   */
  async upsertMatchAndCreateMovePromise(
    match: Match,
    move: Move,
    originalMoveAt: Date,
    isNewMatch: boolean
  ): Promise<[Match, Move]> {
    await this.dbService.ensureConnected();

    const session = this.dbService.client.startSession({
      // defaultTransactionOptions: {
      //   readPreference: 'primary',
      //   readConcern: { level: 'local' }, //?? majority
      //   writeConcern: { w: 'majority' },
      // },
    });

    try {
      await session.withTransaction(async () => {
        // beware: on write conflict the complete transaction will be retried -- should stop it with outside read of initial state, makes no harm, still not neccessary

        // -- if new match: insert new match
        if (isNewMatch) {
          match.startedAt = new Date();
          const dbitem = await this.dbService?.collections.matches?.insertOne(match, { session });
          if (!dbitem) throw new Error('Could not create Match.');
          match._id = dbitem.insertedId;
          move.matchId = match._id;
        }

        // -- insert move
        {
          const dbitem = await this.dbService?.collections.moves?.insertOne(move, { session });
          if (!dbitem) throw new Error('Could not create Move.');
          move._id = dbitem.insertedId;
        }

        // -- if not new match: update changing part of match
        if (!isNewMatch) {
          // -- we ensure checking if in sync with Match definition
          type IMatchCoreRequired = Required<IMatchCoreChangingDb>;
          const matchObj = match.toJSON(); // -- probably not good, still there is some pre-persistance logic executed encapsulated in the match logic
          const updateset: IMatchCoreRequired = {
            lastMoveAt: matchObj.lastMoveAt,
            moveCount: matchObj.moveCount,
            moveCountInTurn: matchObj.moveCountInTurn,
            turnCount: matchObj.turnCount,
            state: matchObj.state ?? new State(),
            stateAtTurnStart: matchObj.stateAtTurnStart ?? new State(),
            currentPlayerIndex: matchObj.currentPlayerIndex,
            activePlayerIdCached: matchObj.activePlayerIdCached,
          };

          const dbitem = await this.dbService?.collections.matches?.updateOne(
            { _id: match._id, lastMoveAt: originalMoveAt },
            { $set: updateset },
            { session }
          );
          // TRY: db changestream receives full document this way, ugly short term workaround -> need better arch alternative
          // const dbitem = await this.dbService.matches.replaceOne({ _id: match._id, lastMoveAt: originalMoveAt }, match, {
          //   session,
          // });
          if (!dbitem || !dbitem.matchedCount) throw new Error('Could not update Match.');
        }
      });
    } catch (e) {
      throw e;
    } finally {
      await session.endSession();
    }

    return [match, move];
  }

  /**
   * Gets match count for a date range
   * @param from
   * @param to
   * @returns match count for date range
   */
  async getMatchCountForDateRange(
    from: Date,
    to: Date,
    playerid: ObjectIdString
  ): Promise<{ day: Date; count: number }[]> {
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService?.collections.matches
      ?.aggregate([
        {
          $match: {
            $and: [
              { $expr: { $gte: ['$startedAt', from] } },
              { $expr: { $lt: ['$startedAt', to] } },
              ...(playerid ? [{ playerids: new ObjectId(playerid) }] : []),
            ],
          },
        },
        {
          $group: {
            _id: { $dateTrunc: { unit: 'day', date: '$startedAt' } },
            count: { $count: {} },
          },
        },
        {
          $sort: { _id: +1 },
        },
      ])
      .toArray();

    const result = dbitems?.map((pojo: any) => ({ day: pojo._id, count: pojo.count })) ?? [];
    return result;
  }

  private resetPlayersCache() {
    this.playersCache = null;
  }
  private playersCache: Map<ObjectIdString, Player> | null;

  // === DB Change monitoring =================================================

  onMatchesChanged = new EventEmitter();
  onMovesChanged = new EventEmitter();

  /**
   * Handles Db collection changes
   * @param collection
   * @param documentKey
   * @param operationType
   * @param item
   */
  private async handleDbCollectionChange(collection: string, documentKey: string, operationType: string, item: any) {
    switch (collection) {
      case 'players':
        await this.handlePlayersChanged(documentKey, operationType, item);
        break;
      case 'matches':
        await this.handleMatchesChanged(documentKey, operationType, item);
        break;
      case 'moves':
        await this.handleMovesChanged(documentKey, operationType, item);
        break;
    }
  }

  /**
   * Reacts to Players collection changed
   * @param documentKey
   * @param operationType
   * @param item
   */
  private async handlePlayersChanged(documentKey: string, operationType: string, item: any) {
    // -- invalidate players' cache, do it even if noone is connected
    this.resetPlayersCache();
    await this.getPlayersPromise();
  }

  /**
   * Reacts to Matches collection changed
   * @param documentKey
   * @param operationType
   * @param item
   */
  private async handleMatchesChanged(documentKey: string, operationType: string, item: any) {
    try {
      if (operationType === 'replace' || operationType === 'update' || operationType === 'insert') {
        // -- 'update' is missing important fields --> should read from db->async cannot store in a transient state in res.local (as we are in multiple nodes)
        let match: Match | undefined;
        if (item.hasOwnProperty('fullDocument')) match = Match.constructFromObject(item.fullDocument);
        else match = await this.getMatchByIdPromise(documentKey);
        if (!match) throw new Error('Match not found or constructable from Db object');

        this.onMatchesChanged.emit('changed', match);
      }
    } catch (e) {
      Logger.error(e.message);
    }
  }

  /**
   * Reacts to Moves collection changed
   * @param documentKey
   * @param operationType
   * @param item
   */
  private async handleMovesChanged(documentKey: string, operationType: string, item: any) {
    try {
      if (operationType === 'insert') {
        const move = Move.constructFromObject(item.fullDocument);
        if (!move) throw new Error('Cannot construct move from Db Object');
        this.onMovesChanged.emit('changed', move);
      }
    } catch (e) {
      Logger.error(e.message);
    }
  }
}
