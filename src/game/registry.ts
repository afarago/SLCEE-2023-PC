import "core-js/es/array/at";
import Match, { MatchId } from "./match";
import Player, { PlayerId } from "./player";
import Move from "./move";
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
  //players: model.Player[] = [];
  matches: Match[] = [];

  public async getMatchesPromise(): Promise<Match[]> {
    let results = gen2array(this.ddbmapper.scan(Match));
    return results;
  }
  public async putMatchPromise(match: Match): Promise<Match> {
    const itemCreated = await this.ddbmapper.put(match);
    match.id = itemCreated?.id;
    return itemCreated;
  }

  public async getMatchByIdPromise(id: MatchId): Promise<Match> {
    const results = await gen2array(this.ddbmapper.query(Match, { id: id }));
    return results.at(0);
  }

  public async getPlayersPromise(): Promise<Array<Player>> {
    let results = gen2array(this.ddbmapper.scan(Player));
    return results;
  }
  public async getPlayerByIdPromise(id: PlayerId): Promise<Player> {
    const results = await gen2array(this.ddbmapper.query(Player, { id: id }));
    return results.at(0);
  }
  // public async getPlayersByIdsPromise(id: PlayerId): Promise<Player> {
  //   const results = await gen2array(this.ddbmapper.query(Player, { id: id }));
  //   return results.at(0);
  // }

  //-- matchId=x, sequenceId->max
  public async getLastMoveByMatchIdPromise(matchId: MatchId): Promise<Move> {
    const results = await gen2array(
      this.ddbmapper.query(
        Move,
        { matchId: matchId },
        { limit: 1, scanIndexForward: false }
      )
    ); //projection: ["sequenceId"],

    return results.at(0);
  }

  // QuerySpec querySpec = new QuerySpec();
  //       querySpec.withKeyConditionExpression("PRIMARYKEY = :key")
  //               .withValueMap(new ValueMap()
  //                       .withString(":key", primaryKeyValue));
  //       querySpec.withScanIndexForward(true);
  //       querySpec.withMaxResultSize(1);

  public async putMovePromise(move: Move): Promise<Move> {
    const itemCreated = await this.ddbmapper.put(move);
    //TODO: add sequenceId
    move.id = itemCreated?.id;
    return itemCreated;
  }
}

// valueConstructor: MyDomainClass,
// keyCondition: {
//     hashKey: 'foo',
//     rangeKey: between(10, 99)
// }
