import { MatchDTO, MatchEventDTO, MoveDTO } from '../dto/matchresponse';
import Match from '../models/game/match';
import MatchEvent from '../models/game/matchevent';
import Move from '../models/game/move';
import Player from '../models/game/player';
import { MatchHeaderDTO } from './matchheader';
import { PlayerDTO } from './playerresponse';

export class BaseError extends Error {}
export class APIError extends BaseError {
  constructor(public statusCode: number, public override message: string, public data?: any) {
    super(message);
    // Error.captureStackTrace(this);
  }
}
export class GameError extends BaseError {}

export function eventToDTO(input: MatchEvent, options?: { hidePlayerIndex?: boolean }): MatchEventDTO {
  const item: any = structuredCloneWA(input); // create a shallow copy, to remove unneeded properties
  delete item.state;

  const dto = item as MatchEventDTO;
  if (!options?.hidePlayerIndex && input.currentPlayerIndex !== null) dto.playerIndex = input.currentPlayerIndex;

  return dto;
}

export function moveToDTO(input: Move, options?: { isDebug?: boolean; hidePlayerIndex?: boolean }): MoveDTO {
  // TODO: remove all noncompliant attributes
  // let keyDst = keys<MoveDTO>();
  // const dto: any = Object.entries(input).reduce((a, [k, v]) => {
  //   if (keyDst.find((ka) => ka === k)) {
  //     a[k] = v;
  //   }
  //   return a;
  // }, {} as any) as MoveDTO;
  const item = structuredCloneWA(input.toJSON()); // delete item.stateCache
  delete item._id;
  delete item.matchId;
  delete item.events;
  if (!options?.isDebug) {
    delete item.userAction;
    delete item.clientIP;
  }

  const dto = item as MoveDTO;
  dto.events = input.events.map((event) => eventToDTO(event, options));

  return dto;
}

export function matchToDTO(
  input: Match,
  playerNames?: string[],
  options?: { isDebug?: boolean; hidePlayerIndex?: boolean }
): MatchDTO {
  const retval: any = structuredCloneWA(input.toJSON());
  // -- create a shallow copy, to remove unneeded properties, adn add ones needed by user
  // -- original state will remain intact

  // if (!retval.state) retval.state = { ...match.state }; // -- backward compatibility, when state was not stored with match
  delete retval.stateAtTurnStart;
  delete retval.currentPlayerId;
  delete retval.currentPlayerIndex;
  if (!options?.isDebug) {
    // -- delete sensitive data
    delete retval.state.drawPile;
    delete retval.state.discardPile;
    delete retval.state.stateAtTurnStart;
    // -- delete unneccessary data
    delete retval.creationParams;
  } else {
    if (retval.creationParams) delete retval.creationParams.playerids;
  }

  const dto = retval as MatchDTO;
  dto.activePlayerIndex = input.getActivePlayerIdx();
  dto.drawPileSize = input.state?.drawPile?.length ?? -1;
  dto.discardPileSize = input.state?.discardPile?.length ?? -1;
  if (playerNames) dto.playernames = playerNames;

  return dto;
}

/**
 * Parses booly value query trurty from string
 * @param value
 * @returns
 */
export function parseBoolyFromString(value?: BoolLikeString) {
  return value === 'true' || value === '1';
}
export type BoolLikeString = 'true' | 'false' | '1' | '0';

export function structuredCloneWA(val: any) {
  // -- structuredClone comes only with Node17
  return JSON.parse(JSON.stringify(val));
}

/**
 * Match record to be comunicated between frontend CSR and backend, also used as an initial state SSRd
 * @param match
 * @param [playersData] initial list of playerdata to convey player names
 * @returns JSON structure
 */
export function matchToHeaderDTO(match: Match, playersData?: Map<string, Player>): MatchHeaderDTO {
  const partToDeliverAtStart = playersData
    ? {
        startedat: match.startedAt,
        tags: match.creationParams?.tags,
        playernames: match.playerids?.map((pid) => playersData.get(pid.toString())?.name ?? ''),
      }
    : {};

  const partToDeliverAlways = {
    id: match._id.toString(),
    sequence: `${match.turnCount}.${match.moveCountInTurn ?? '▷'}`,
    lastmoveat: match.lastMoveAt,
    finished: match.isFinished,
    table: {
      effect: match.state?.pendingEffect?.effectType,
      playarea: match.state?.playArea?.length ?? -1,
      drawpile: match.state?.drawPile?.length ?? -1,
      discardpile: match.state?.discardPile?.length ?? -1,
    },
    playerdata: match.playerids?.map((pid, idx) => ({
      active: match.getActivePlayerIdx() === idx,
      winner: match.state?.winnerIdx === idx,
      banksize: match.state?.banks?.[idx]?.flatSize ?? -1,
      bankvalue: match.state?.banks?.[idx]?.bankvalue ?? -1,
    })),
  };

  const retval: MatchHeaderDTO = { ...partToDeliverAlways, ...partToDeliverAtStart };
  return retval;
}

// try {
// } catch (e) {
// Logger.error(e.message, { matchId: match?._id });
// return undefined;
// }

export function playerToDTO(input: Player): PlayerDTO {
  const item = structuredCloneWA(input);
  delete item.passwordhash;
  const dto = item as PlayerDTO;
  return dto;
}
