import "core-js/es/array/at";
import * as model from "./model/model";
import { Player, Match, Move } from "./model/model";
import * as mongoDB from "mongodb";
import { ObjectId } from "mongodb";

async function gen2array<T>(gen: AsyncIterable<T>): Promise<Array<T>> {
  const out: Array<T> = new Array<T>();
  for await (const x of gen) {
    out.push(x);
  }
  return out;
}
// async function gen2mapbyid<T>(gen: AsyncIterable<T>): Promise<Map<any, T>> {
//   const out: Map<any, T> = new Map<any, T>();
//   for await (const x of gen) {
//     const id = (<any>x).id;
//     if (id) out.set(id, x);
//   }
//   return out;
// }

/**
 * Registry singleton to DB/DTO access
 */
export default class Registry {
  private static _instance: Registry;
  public static get Instance(): Registry {
    return this._instance || (this._instance = new this());
  }
  private constructor() {}

  private client: mongoDB.MongoClient;
  private db: mongoDB.Db;
  private collections: {
    players?: mongoDB.Collection;
    matches?: mongoDB.Collection;
    moves?: mongoDB.Collection;
  } = {};

  public async connectDatabase() {
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
    const dbitems = await this.collections.matches?.find({}).sort({ startedAt: "asc" }).toArray();
    const results = dbitems.map((pojo) => new Match().populate(pojo));
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
  public async getMatchesByCurrentPlayerPartialPromise(
    playerId: string
  ): Promise<Array<model.Match>> {
    await this.connectDatabase();

    // const results = await gen2array(
    //   this.ddbmapper.query(
    //     model.Match,
    //     { currentPlayerId: playerId },
    //     { indexName: "currentPlayerId-lastMoveAt-index" } //IMPORTANT: only keys are added, thus result will be partial
    //   )
    // );

    // return results;
    //TODO
    return null;
  }

  /**
   * Updates a match
   * @param match
   * @returns match promise
   */
  public async updateMatchPromise(match: model.Match): Promise<model.Match> {
    await this.connectDatabase();

    // const item = await this.ddbmapper.update(match);
    // return item;
    //TODO
    return null;
  }

  /**
   * Gets players
   * @returns players promise
   */
  public async getPlayersPromise(): Promise<Array<model.Player>> {
    await this.connectDatabase();

    const dbitems = await this.collections.players?.find({}).toArray();
    const results = dbitems.map((pojo) => new Player().populate(pojo));
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
        sort: { sequenceId: "desc" },
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
  public async getAllMovesByMatchIdPromise(matchId: ObjectId): Promise<Array<model.Move>> {
    await this.connectDatabase();

    const dbitems = await this.collections.moves
      .find({ matchId: matchId })
      .sort({ sequenceId: "asc" })
      .toArray();
    if (!dbitems) throw new Error("Error retrieving moves");

    const result = dbitems.map((dbitem) => new Move().populate(dbitem));
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
