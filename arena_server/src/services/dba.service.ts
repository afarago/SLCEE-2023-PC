import 'reflect-metadata';

import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import * as util from 'util';

import Logger from '../config/logger';
import Match, { IMatchCoreChanging } from '../models/game/match';
import Move from '../models/game/move';
import Player from '../models/game/player';
import DbService from './db.service';

// -- confidentiality protection, removing e.g. passwordhash field
const playerConfidentialityProjection = {
  projection: { _id: 1, name: 1, email: 1 },
};

/**
 * Stringified Object Id.
 * @pattern [0-9a-f]{24}|[0-9a-f]{12}
 * @format ObjectId
 * @example "30d2b1b242ea506dcc6504de"
 */
export type ObjectIdString = string;

@Service()
export default class DBAService {
  constructor(private dbService: DbService) {}

  /**
   * Returns Gets all matches
   * @param options  filter user id, active/current user id, date day, tags
   * @returns matches promise
   */
  public async getMatchesPromise(options: {
    playerId?: ObjectIdString;
    currentPlayerId?: ObjectIdString;
    date?: Date;
    tags?: string[];
    limit?: {
      startId?: ObjectIdString;
      count: number;
    };
    sortAscending?: boolean;
  }): Promise<Match[]> {
    let filterOption = {
      ...(options?.playerId
        ? {
            playerids: new ObjectId(options?.playerId),
          }
        : {}),
      ...(options?.currentPlayerId
        ? {
            currentPlayerId: new ObjectId(options?.currentPlayerId),
          }
        : {}),
      ...(options?.tags
        ? {
            'creationParams.tags': { $all: options.tags },
          }
        : {}),
      ...(options?.limit?.startId
        ? {
            _id: { $gt: new ObjectId(options.limit.startId) },
          }
        : {}),
    };
    if (options?.date) {
      const filterToday1 = new Date(options?.date);
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
    const matchesCursor = this.dbService.matchesCollection
      .find(filterOption)
      .sort({ startedAt: options.sortAscending ? +1 : -1 })
      //-- A limit() value of 0 (i.e. .limit(0)) is equivalent to setting no limit.
      //-- By passing a negative limit, the client indicates to the server that it will not ask for a subsequent batch via getMore
      .limit(options?.limit?.count > 0 ? -(options.limit.count + 1) : 0);
    const dbitems = await matchesCursor.toArray();

    const results = dbitems
      ?.map((pojo: any) => {
        try {
          return Match.constructFromObject(pojo);
        } catch {
          Logger.error(`Invalid object: ${util.inspect(pojo)}`);
        }
      })
      .filter((elem) => !!elem);

    return results;
  }

  /**
   * Gets match by id
   * @param id
   * @returns match by id promise
   */
  public async getMatchByIdPromise(id: ObjectIdString): Promise<Match | null> {
    await this.dbService.ensureConnected();
    const dbitem = await this.dbService.matchesCollection.findOne({ _id: new ObjectId(id) });
    if (!dbitem) return null;

    const result = Match.constructFromObject(dbitem);
    return result;
  }

  /**
   * Gets players
   * @returns players promise
   */
  public async getPlayersPromise(isHeadOnly?: boolean): Promise<Player[]> {
    const options = isHeadOnly ? playerConfidentialityProjection : null;
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService.playersCollection.find({}, options).toArray();
    const results = dbitems
      ?.map((pojo: any) => {
        try {
          return Player.constructFromObject(pojo);
        } catch {
          Logger.error(`Invalid object: ${util.inspect(pojo)}`);
        }
      })
      .filter((elem) => !!elem);
    return results;
  }

  /**
   * Gets a player by id
   * @param id
   * @returns player by id promise
   */
  public async getPlayerByIdPromise(id: ObjectIdString, isHeadOnly?: boolean): Promise<Player | null> {
    const options = isHeadOnly ? playerConfidentialityProjection : null;
    await this.dbService.ensureConnected();
    const dbitem = await this.dbService.playersCollection.findOne({ _id: new ObjectId(id) }, options);
    if (!dbitem) return null;

    const result = Player.constructFromObject(dbitem);
    return result;
  }

  /**
   * Gets players by ids
   * @param ids
   * @returns players by ids promise
   */
  public async getPlayerByIdsPromise(ids: ObjectIdString[], isHeadOnly?: boolean): Promise<Player[]> {
    const options = isHeadOnly ? playerConfidentialityProjection : null;
    const oids = ids?.map((id) => new ObjectId(id));
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService.playersCollection.find({ _id: { $in: oids } }, options).toArray();
    if (!dbitems) throw new Error('Error retrieving players');

    const result: Player[] = ids?.map((id) => {
      const dbitem = dbitems?.find((item: any) => item._id?.equals(id));
      if (dbitem) return Player.constructFromObject(dbitem);
      throw new Error(`Player ${id} is not valid.`);
    });

    return result;
  }

  /**
   * Gets last move by match id
   * @param matchId
   * @returns last move by match id promise
   */
  public async getLastMoveByMatchIdPromise(matchId: ObjectIdString): Promise<Move> {
    await this.dbService.ensureConnected();
    const matchIdObj = new ObjectId(matchId);
    const dbitem = await this.dbService.movesCollection.findOne(
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
  public async getAllMovesByMatchIdPromise(matchId: ObjectIdString): Promise<Move[]> {
    const matchIdObj = new ObjectId(matchId);
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService.movesCollection
      .find({ matchId: matchIdObj })
      .sort({ sequenceId: +1 })
      .toArray();
    if (!dbitems) throw new Error('Error retrieving moves');

    const results = dbitems
      ?.map((pojo: any) => {
        try {
          return Move.constructFromObject(pojo);
        } catch {
          Logger.error(`Invalid object: ${util.inspect(pojo)}`);
        }
      })
      .filter((elem) => !!elem);
    return results;
  }

  /**
   * Updates match and creates a move in transaction
   * @param match
   * @param move
   * @param originalMoveAt safeguarding that we still update the original match record and there is no concurrent access
   * @returns match and create move promise
   */
  public async upsertMatchAndCreateMovePromise(
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

        //-- if new match: insert new match
        if (isNewMatch) {
          match.startedAt = new Date();
          const dbitem = await this.dbService.matchesCollection.insertOne(match, { session });
          if (!dbitem) throw new Error('Could not create Match.');
          match._id = dbitem.insertedId;
          move.matchId = match._id;
        }

        // -- insert move
        {
          const dbitem = await this.dbService.movesCollection.insertOne(move, { session });
          if (!dbitem) throw new Error('Could not create Move.');
          move._id = dbitem.insertedId;
        }

        // -- if not new match: update changing part of match
        if (!isNewMatch) {
          // -- we ensure checking if in sync with Match definition
          type IMatchCoreRequired = Required<IMatchCoreChanging>;
          const matchObj = match.toJSON(); // -- probably not good, still there is some pre-persistance logic executed encapsulated in the match logic
          const updateset: IMatchCoreRequired = {
            lastMoveAt: matchObj.lastMoveAt,
            moveCount: matchObj.moveCount,
            moveCountInTurn: matchObj.moveCountInTurn,
            turnCount: matchObj.turnCount,
            state: matchObj.state,
            stateAtTurnStart: matchObj.stateAtTurnStart,
            currentPlayerId: matchObj.currentPlayerId,
            currentPlayerIndex: matchObj.currentPlayerIndex,
          };

          const dbitem = await this.dbService.matchesCollection.updateOne(
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
  public async getMatchCountForDateRange(
    from: Date,
    to: Date,
    playerid: ObjectIdString
  ): Promise<{ day: Date; count: number }[]> {
    await this.dbService.ensureConnected();
    const dbitems = await this.dbService.matchesCollection
      .aggregate([
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

    const result = dbitems.map((pojo: any) => ({ day: pojo._id, count: pojo.count }));
    return result;
  }

  /**
   * Gets players cache
   * @returns
   */
  public async getPlayersCache() {
    if (!this.playersCache) {
      const playerobjs = await this.getPlayersPromise();
      this.playersCache = playerobjs?.reduce(
        (prev, current) => prev.set(current._id.toString(), current),
        new Map<string, Player>()
      );
    }
    return this.playersCache;
  }
  public resetPlayersCache() {
    this.playersCache = null;
  }
  private playersCache: Map<string, Player>;
}
