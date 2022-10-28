import "core-js/es/array/at";
import * as model from "./model/model";
import { DynamoDB } from "aws-sdk";
import { DataMapper, embed } from "@aws/dynamodb-data-mapper";
import { between } from "@aws/dynamodb-expressions";

async function gen2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) {
    out.push(x);
  }
  return out;
}
export default class Registry {
  private static _instance: Registry;
  public static get Instance(): Registry {
    return this._instance || (this._instance = new this());
  }

  ddb = new DynamoDB({ region: "eu-central-1" });
  ddbmapper = new DataMapper({ client: this.ddb, tableNamePrefix: "spc2022_" });

  public async getMatchesPromise(): Promise<model.Match[]> {
    let results = await gen2array(
      this.ddbmapper.scan(model.Match, { indexName: "startedAt-index" })
    );
    return results;
  }
  public async putMatchPromise(match: model.Match): Promise<model.Match> {
    const itemCreated = await this.ddbmapper.put(match);
    match.id = itemCreated?.id;
    return itemCreated;
  }

  public async getMatchByIdPromise(id: model.MatchId): Promise<model.Match> {
    const results = await gen2array(this.ddbmapper.query(model.Match, { id: id }));
    return results.at(0);
  }

  public async getPlayersPromise(): Promise<Array<model.Player>> {
    let results = gen2array(this.ddbmapper.scan(model.Player));
    return results;
  }
  public async getPlayerByIdPromise(id: model.PlayerId): Promise<model.Player> {
    const results = await gen2array(this.ddbmapper.query(model.Player, { id: id }));
    return results.at(0);
  }
  // public async getPlayersByIdsPromise(id: PlayerId): Promise<Player> {
  //   const results = await gen2array(this.ddbmapper.query(Player, { id: id }));
  //   return results.at(0);
  // }

  //-- matchId=x, sequenceId->max
  public async getLastMoveByMatchIdPromise(matchId: model.MatchId): Promise<model.Move> {
    const results = await gen2array(
      this.ddbmapper.query(model.Move, { matchId: matchId }, { limit: 1, scanIndexForward: false })
    ); //projection: ["sequenceId"],

    return results.at(0);
  }

  public async getAllMovesByMatchIdPromise(matchId: model.MatchId): Promise<Array<model.Move>> {
    const results = await gen2array(
      this.ddbmapper.query(model.Move, { matchId: matchId }, { scanIndexForward: true })
      //this.ddbmapper.scan(model.Move, { matchId })
    ); //projection: ["sequenceId"],

    return results;
  }

  // QuerySpec querySpec = new QuerySpec();
  //       querySpec.withKeyConditionExpression("PRIMARYKEY = :key")
  //               .withValueMap(new ValueMap()
  //                       .withString(":key", primaryKeyValue));
  //       querySpec.withScanIndexForward(true);
  //       querySpec.withMaxResultSize(1);

  public async putMovePromise(move: model.Move): Promise<model.Move> {
    const itemCreated = await this.ddbmapper.put(move);
    move.id = itemCreated?.id;
    return itemCreated;
  }
}

// valueConstructor: MyDomainClass,
// keyCondition: {
//     hashKey: 'foo',
//     rangeKey: between(10, 99)
// }
