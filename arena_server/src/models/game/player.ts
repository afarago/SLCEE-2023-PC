import { ObjectId } from 'mongodb';

import { Hydrate } from '../../utils/hydration.util';

export type PlayerId = ObjectId;

export const DUMMY_PLAYER_ID = '000000000000000000000000';

/**
 * Player object - representing a single player (or team)
 */
export default class Player {
  static constructFromObject(data: any, obj?: Player) {
    if (data) {
      obj = obj || new Player();

      Hydrate.convertFrom(data, '_id', ObjectId, obj);
      Hydrate.convertFrom(data, 'name', 'String', obj);
      Hydrate.convertFrom(data, 'passwordhash', 'String', obj);
      Hydrate.convertFrom(data, 'email', 'String', obj);
    }

    return obj;
  }

  _id: PlayerId;
  name: string;
  passwordhash?: string | null;
  email?: string | null;
}
