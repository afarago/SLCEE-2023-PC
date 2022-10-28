import "core-js/es/array/at";
import * as model from "./model/model";
import { DynamoDB } from "aws-sdk";
import { DataMapper, embed } from "@aws/dynamodb-data-mapper";
import { between } from "@aws/dynamodb-expressions";
//import {Marshaller} from '@aws/dynamodb-auto-marshaller';

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

  ddb = new DynamoDB({ region: "eu-central-1" });
  ddbmapper = new DataMapper({ client: this.ddb, tableNamePrefix: "spc2022_" });
  //const marshaller = new Marshaller({unwrapNumbers: true});

  /**
   * Gets all matches
   * @returns matches promise
   */
  public async getMatchesPromise(): Promise<model.Match[]> {
    let results = await gen2array(
      this.ddbmapper.scan(model.Match, { indexName: "startedAt-index" })
    );
    return results;
  }
  /**
   * Add a new match
   * @param match
   * @returns match promise
   */
  public async putMatchPromise(match: model.Match): Promise<model.Match> {
    const itemCreated = await this.ddbmapper.put(match);
    match.id = itemCreated?.id;
    match.startedAt = itemCreated?.startedAt;
    return itemCreated;
  }

  /**
   * Gets match by id
   * @param id
   * @returns match by id promise
   */
  public async getMatchByIdPromise(id: model.MatchId): Promise<model.Match> {
    const results = await gen2array(this.ddbmapper.query(model.Match, { id: id }));
    return results.at(0);
  }

  /**
   * Gets matches by current player (partial results)
   * @param playerId
   * @returns matches by current player partial promise
   */
  public async getMatchesByCurrentPlayerPartialPromise(
    playerId: model.PlayerId
  ): Promise<Array<model.Match>> {
    const results = await gen2array(
      this.ddbmapper.query(
        model.Match,
        { currentPlayerId: playerId },
        { indexName: "currentPlayerId-lastMoveAt-index" } //IMPORTANT: only keys are added, thus result will be partial
      )
    );

    return results;
  }

  /**
   * Updates a match
   * @param match
   * @returns match promise
   */
  public async updateMatchPromise(match: model.Match): Promise<model.Match> {
    const item = await this.ddbmapper.update(match);
    return item;
  }

  /**
   * Gets players
   * @returns players promise
   */
  public async getPlayersPromise(): Promise<Array<model.Player>> {
    let results = gen2array(this.ddbmapper.scan(model.Player));
    return results;
  }

  /**
   * Gets a player by id
   * @param id
   * @returns player by id promise
   */
  public async getPlayerByIdPromise(id: model.PlayerId): Promise<model.Player> {
    const results = await gen2array(this.ddbmapper.query(model.Player, { id: id }));
    return results.at(0);
  }

  /**
   * Gets last move by match id
   * @param matchId
   * @returns last move by match id promise
   */
  public async getLastMoveByMatchIdPromise(matchId: model.MatchId): Promise<model.Move> {
    const results = await gen2array(
      this.ddbmapper.query(model.Move, { matchId: matchId }, { limit: 1, scanIndexForward: false })
    ); //projection: ["sequenceId"],

    return results.at(0);
  }

  /**
   * Gets all moves by match id
   * @param matchId
   * @returns all moves by match id promise
   */
  public async getAllMovesByMatchIdPromise(matchId: model.MatchId): Promise<Array<model.Move>> {
    const results = await gen2array(
      this.ddbmapper.query(model.Move, { matchId: matchId }, { scanIndexForward: true })
      //this.ddbmapper.scan(model.Move, { matchId })
    ); //projection: ["sequenceId"],

    return results;
  }

  /**
   * Creates a new move
   * @param move
   * @returns move promise
   */
  public async createMovePromise(move: model.Move): Promise<model.Move> {
    const itemCreated = await this.ddbmapper.put(move);
    move.id = itemCreated?.id;
    move.at = itemCreated?.at;
    return itemCreated;
  }
}

// valueConstructor: MyDomainClass,
// keyCondition: {
//     hashKey: 'foo',
//     rangeKey: between(10, 99)
// }
