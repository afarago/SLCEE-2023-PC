import { Hydrate } from '../../utils/hydration.util';
import CardEffectResponse from './cardeffectresponse';

export const OMatchActionType = {
  Draw: 'Draw',
  EndTurn: 'EndTurn',
  ResponseToEffect: 'ResponseToEffect',
} as const;
export type MatchActionType = keyof typeof OMatchActionType;
export function IsMatchActionType(value?: string): value is MatchActionType {
  return Object.values(OMatchActionType).includes(value as MatchActionType);
}

// export function IsInEnum<T>(value?: string, anenum: T): value is keyof T {
//   return Object.values(anenum).includes(value as keyof T);
// }

/**
 * User action sent by the player
 */
export interface IUserAction {
  etype?: MatchActionType;
  effect?: CardEffectResponse;
  autopick?: boolean;
}

/**
 * User action sent by the player
 */
class UserAction implements IUserAction {
  static constructFromObject(data: any, obj?: UserAction) {
    if (data) {
      obj = obj || new UserAction();

      Hydrate.convertFrom(data, 'etype', 'MatchActionType', obj);
      Hydrate.convertFrom(data, 'effect', CardEffectResponse, obj);
      Hydrate.convertFrom(data, 'autopick', 'Boolean', obj);
    }
    return obj;
  }

  constructor(
    public etype?: MatchActionType,
    public effect?: CardEffectResponse,
    public autopick?: boolean
  ) {}

  // -- need this interface otherwise tsoa will yield to an empty UserAction due to toJSON -- not sure if it is a bug, tbc (:any -> return empty, :UserAction crashes tsoa)
  toJSON(): IUserAction {
    const pojo = { ...this };
    if (!pojo.effect) delete pojo.effect;
    if (!pojo.autopick) delete pojo.autopick;

    return pojo;
  }
  toBSON() {
    return this.toJSON();
  }
}

export default UserAction;
