import { ObjectIdString } from '../../services/dba.service';
import { Hydrate } from '../../utils/hydration.util';
import Card from './card';
import { integer } from './model';

type MatchCreationParamsKeys = keyof MatchCreationParams;
/**
 * Match creation parameters including players, drawpile, discardpile and randomseed
 */
export default class MatchCreationParams {
  static constructFromObject(data: any, obj?: MatchCreationParams) {
    if (data) {
      obj = obj || new MatchCreationParams();

      Hydrate.convertFrom(data, 'playerids', ['ObjectIdString'], obj);
      Hydrate.convertFrom(data, 'tags', ['String'], obj);
      Hydrate.convertFrom(data, 'playArea', [Card], obj);
      Hydrate.convertFrom(data, 'drawPile', [Card], obj);
      Hydrate.convertFrom(data, 'discardPile', [Card], obj);
      Hydrate.convertFrom(data, 'banks', [[Card]], obj); // -- important not Bank, rarher a simplified format
      Hydrate.convertFrom(data, 'randomSeed', 'String', obj);
      Hydrate.convertFrom(data, 'timeout', 'Number', obj);
    }
    return obj;
  }

  /**
   * List of players. Omit to request a 'practice' match.
   * @example ["269b4f148ce2269b4f148ce2", "269b4f148ce2269b4f148ab3"]
   * @minItems 2 Two players should be specified
   * @maxItems 2 Two players should be specified
   */
  playerids?: ObjectIdString[]; // [string, string];
  /**
   * Tags to add to match for later filtering
   */
  tags?: string[];
  /**
   * [Debug purposes] Play Area initial contents of cards.
   * @example [ ["Oracle", 4], ["Anchor", 4], ["Mermaid", 5] ]
   */
  playArea?: Card[];
  /**
   * [Debug purposes] Draw pile initial contents of cards. When omitted default will be generated.
   * @example [ ["Oracle", 4], ["Anchor", 4], ["Mermaid", 5] ]
   */
  drawPile?: Card[];
  /**
   * [Debug purposes] Discard pile initial contents of cards. When omitted default will be generated.
   * @example [ ["Mermaid", 2], ["Hook", 2] ]
   */
  discardPile?: Card[];
  /**
   * [Debug purposes] Banks initial contents of cards. When omitted match will start with empty banks.
   * @example [ ["Mermaid", 4] ], [ ["Hook", 4], ["Cannon", 5] ]
   */
  banks?: Card[][];
  /**
   * [Debug purposes] Optional seed value for pseudorandom generator used for randomization of starting player, card drawing.
   * Match creation returns a the input or generated seed so you can recreate any game during development.
   * To ignore randomization and pick first item always use "norandom".
   * @example "20221105HelloWorld"
   * @example "norandom"
   */
  randomSeed?: string;
  /**
   * Timeout - number of seconds after the match is considered stale and may be terminated
   */
  timeout?: integer;
}
