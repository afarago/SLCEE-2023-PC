import {
  attribute,
  hashKey,
  autoGeneratedHashKey,
  rangeKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";
import { ObjectId } from "mongodb";
import { SupportsHydration } from "./model";

export type PlayerId = ObjectId;

/**
 * Player object - representing a single player (or team)
 */
@table("Players")
export default class Player implements SupportsHydration {
  populate(pojo: any): any {
    if (!pojo) throw new Error("empty hydration object");
    if (pojo.hasOwnProperty("_id")) this._id = new ObjectId(pojo._id);
    if (pojo.hasOwnProperty("name")) this.name = pojo.name;
    return this;
  }

  @autoGeneratedHashKey()
  _id: PlayerId;

  @attribute()
  name?: string;

  constructor(_id?: PlayerId, name?: string) {
    if (_id) this._id = _id;
    if (name) this.name = name;
  }
}
