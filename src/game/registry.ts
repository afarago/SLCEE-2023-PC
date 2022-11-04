import "core-js/es/array/at";
import * as model from "./model/model";
import { Player, Match, Move } from "./model/model";
import * as mongoDB from "mongodb";
import { ObjectId } from "mongodb";
import * as gen from "random-seed";

/**
 * Registry singleton to DB/DTO access
 */
export default class Registry {
  private static _instance: Registry;
  public static get Instance(): Registry {
    return this._instance || (this._instance = new this());
  }
  private constructor() {
    this.initRandom();
  }

  private randomGenerator: gen.RandomSeed;
  public initRandom(seed?: string) {
    this.randomGenerator = gen.create(seed);
  }
  public getRandom(min: number, max: number): number {
    return this.randomGenerator.intBetween(min, max);
  }

  //--------

  private client: mongoDB.MongoClient;
  private db: mongoDB.Db;
  private collections: {
    players?: mongoDB.Collection;
    matches?: mongoDB.Collection;
    moves?: mongoDB.Collection;
  } = {};

  private async connectDatabase() {
    if (!this.client) {
      this.client = new mongoDB.MongoClient(process.env.MONGODB_CONN_STRING ?? "");
      await this.client.connect();
      this.db = this.client.db(process.env.MONGODB_DBNAME ?? "");
      this.collections = {
        players: this.db.collection("players"),
        matches: this.db.collection("matches"),
        moves: this.db.collection("moves"),
      };
    }
  }

  /**
   * Gets all matches
   * @returns matches promise
   */
  public async getMatchesPromise(): Promise<model.Match[]> {
    await this.connectDatabase();
    const dbitems = await this.collections.matches?.find({}).sort({ startedAt: -1 }).toArray();
    const results = dbitems.map((pojo: any) => new Match().populate(pojo));
    return results;
  }
  /**
   * Add a new match
   * @param match
   * @returns match promise
   */
  public async putMatchPromise(match: model.Match): Promise<model.Match> {
    await this.connectDatabase();

    match.startedAt = new Date();
    const dbitem = await this.collections.matches.insertOne(match);
    if (!dbitem) throw new Error("Could not create Match.");

    match._id = dbitem.insertedId;
    return match;
  }

  /**
   * Gets match by id
   * @param id
   * @returns match by id promise
   */
  public async getMatchByIdPromise(id: string): Promise<model.Match> {
    await this.connectDatabase();

    const dbitem = await this.collections.matches?.findOne({ _id: new ObjectId(id) });
    if (!dbitem) throw new Error("Match " + id + " is not valid.");

    const result = new Match().populate(dbitem);
    return result;
  }

  /**
   * Gets matches by current player (partial results)
   * @param playerId
   * @returns matches by current player partial promise
   */
  public async getMatchesByCurrentPlayerPromise(playerId: string): Promise<Array<model.Match>> {
    await this.connectDatabase();

    const dbitems = await this.collections.matches
      ?.find({ currentPlayerId: new ObjectId(playerId) })
      .sort({ startedAt: +1 })
      .toArray();
    const results = dbitems.map((pojo: any) => new Match().populate(pojo));
    return results;
  }

  /**
   * Updates a match
   * @param match
   * @returns match promise
   */
  public async updateMatchPromise(match: model.Match): Promise<model.Match> {
    await this.connectDatabase();

    const dbitem = await this.collections.matches.replaceOne({ _id: match._id }, match);
    if (!dbitem || !dbitem.matchedCount) throw new Error("Could not update Match.");

    return match;
  }

  /**
   * Gets players
   * @returns players promise
   */
  public async getPlayersPromise(): Promise<Array<model.Player>> {
    await this.connectDatabase();

    const dbitems = await this.collections.players?.find({}).toArray();
    const results = dbitems.map((pojo: any) => new Player().populate(pojo));
    return results;
  }

  /**
   * Gets a player by id
   * @param id
   * @returns player by id promise
   */
  public async getPlayerByIdPromise(id: string): Promise<model.Player> {
    await this.connectDatabase();

    const dbitem = await this.collections.players.findOne({ _id: new ObjectId(id) });
    if (!dbitem) throw new Error("Player " + id + " is not valid.");

    const result = new Player().populate(dbitem);
    return result;
  }

  /**
   * Gets players by ids
   * @param ids
   * @returns players by ids promise
   */
  public async getPlayerByIdsPromise(ids: Array<string>): Promise<Array<model.Player>> {
    await this.connectDatabase();

    const oids = ids.map((id) => new ObjectId(id));
    const dbitems = await this.collections.players.find({ _id: { $in: oids } }).toArray();
    if (!dbitems) throw new Error("Error retrieving players");

    const result: Array<Player> = ids.map((id) => {
      const dbitem = dbitems.find((dbitem: any) => dbitem._id.toString() == id);
      if (dbitem) return new Player().populate(dbitem);
      throw new Error("Player " + id + " is not valid.");
    });

    return result;
  }

  /**
   * Gets last move by match id
   * @param matchId
   * @returns last move by match id promise
   */
  public async getLastMoveByMatchIdPromise(matchId: ObjectId): Promise<model.Move> {
    await this.connectDatabase();

    const dbitem = await this.collections.moves.findOne(
      { matchId: matchId },
      {
        sort: { sequenceId: -1 },
      }
    );
    if (!dbitem) throw new Error("Error retrieving move by match id " + matchId + ".");

    const result = new Move().populate(dbitem);
    return result;
  }

  /**
   * Gets all moves by match id
   * @param matchId
   * @returns all moves by match id promise
   */
  public async getAllMovesByMatchIdPromise(matchId: string): Promise<Array<model.Move>> {
    await this.connectDatabase();
    let matchIdObj = new ObjectId(matchId);

    const dbitems = await this.collections.moves
      .find({ matchId: matchIdObj })
      .sort({ sequenceId: +1 })
      .toArray();
    if (!dbitems) throw new Error("Error retrieving moves");

    const result = dbitems.map((dbitem: any) => new Move().populate(dbitem));
    return result;
  }

  /**
   * Creates a new move
   * @param move
   * @returns move promise
   */
  public async createMovePromise(move: model.Move): Promise<model.Move> {
    await this.connectDatabase();

    move.at = new Date();
    const dbitem = await this.collections.moves.insertOne(move);
    if (!dbitem) throw new Error("Could not create Move.");

    move._id = dbitem.insertedId;
    return move;
  }
}
