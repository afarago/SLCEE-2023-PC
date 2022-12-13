import { IMatchCore } from '../models/game/match';
import { IMatchEventCore } from '../models/game/matchevent';
import { IMatchEventParameters, integer } from '../models/game/model';
import { IMoveAt, IMoveSequence } from '../models/game/move';

/**
 * Match Response Event DTO
 */
export interface MatchEventDTO extends IMatchEventCore, IMatchEventParameters {
  playerIndex?: integer | null;
}

/**
 * Match Response Movement DTO
 * deliver selectively timestamp, sequence along with DTO array of events
 */
export interface MoveDTO extends IMoveAt, IMoveSequence {
  events: MatchEventDTO[];
}

/**
 * Match Response item
 */
export interface MatchDTO extends IMatchCore {
  playernames?: string[];
  moves?: MoveDTO[];
  drawPileSize: integer;
  discardPileSize: integer;
  activePlayerIndex?: integer | null;
}
