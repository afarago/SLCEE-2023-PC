import 'core-js/es/array/at';

import { Service } from 'typedi';

import { IUser } from '../config/passport';
import { MatchDTO } from '../dto/matchresponse';
import { matchToDTO, moveToDTO } from '../dto/utils';
import * as model from '../models/game/model';
import DBAService, { ObjectIdString } from './dba.service';

/**
 * GameController class, main game controller
 */
@Service()
export default class GameService {
  constructor(private dbaService: DBAService) {}

  /**
   * Retrieves and converts match to DTO
   * @param idOrMatch
   * @param user
   * @param doReturnAllMoves true=return all moves OR false=none expect in case of finished match only last one OR null=none
   * @returns matchdto promise
   */
  public async getMatchDTOPromise(
    idOrMatch: ObjectIdString | model.Match,
    options?: {
      user?: IUser;
      playerNames?: string[];
      doReturnAllMoves?: boolean;
      doAddDebug?: boolean;
    }
  ): Promise<MatchDTO> {
    // -- user incoming match or retrieve from db
    const match =
      typeof idOrMatch === 'string' ? await this.dbaService.getMatchByIdPromise(idOrMatch as string) : idOrMatch;
    if (!match) throw new Error('Match not found');

    // const playerData = await this.dbaService.getPlayerByIdsPromise(params.playerids);
    // const playerNames = playerData.map(pd=>pd.name);

    // -- SHOW debug for matches started by this player or if Admin is requesting
    const isDebug =
      options?.doAddDebug && (options?.user?.isAdmin || match.createdByPlayerId?.equals(options?.user?.username ?? ''));
    const retval = matchToDTO(match, options?.playerNames, { isDebug });

    // -- collect and show moves & events
    const moves: model.Move[] = !!options?.doReturnAllMoves
      ? // -- TRUE: return all moves
        await this.dbaService.getAllMovesByMatchIdPromise(match._id.toString())
      : // -- FALSE (not NULL): still return match closing events if match is finished
      options?.doReturnAllMoves === false && match.isFinished
      ? // TODO: consider filtering events
        await (async () => {
          const lastmove = await this.dbaService.getLastMoveByMatchIdPromise(match._id.toString());
          return lastmove ? [lastmove] : [];
        })()
      : [];
    const movesdto = moves?.map((move) => moveToDTO(move, { isDebug }));
    retval.moves = movesdto;

    // if (match.isFinished) {
    //   // -- add last move (match finished) events turnended and matchended
    //   const move = await this.dbaService.getLastMoveByMatchIdPromise(match._id.toString());
    //   const events = move
    //     .getEvents()
    //     .filter(
    //       (event) => event?.eventType === OMatchEventType.TurnEnded || event?.eventType === OMatchEventType.MatchEnded
    //     );

    return retval;
  }

  public IsAuthUserIsActivePlayer(match: model.Match, user: IUser): boolean {
    return match?.getActivePlayerId()?.equals(user?.username) ?? false;
  }
}
