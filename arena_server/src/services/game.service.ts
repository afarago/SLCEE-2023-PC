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
    user: IUser,
    playerNames: string[] | null,
    doReturnAllMoves: boolean | null
  ): Promise<MatchDTO> {
    // -- user incoming match or retrieve from db
    const match =
      typeof idOrMatch === 'string' ? await this.dbaService.getMatchByIdPromise(idOrMatch as string) : idOrMatch;

    // const playerData = await this.dbaService.getPlayerByIdsPromise(params.playerids);
    // const playerNames = playerData.map(pd=>pd.name);

    // -- SHOW debug for matches started by this player or if Admin is requesting
    const isDebug = user?.isAdmin || match.createdByPlayerId?.equals(user?.username);
    const retval = matchToDTO(match, playerNames, { isDebug });

    // -- collect and show moves & events
    const moves = doReturnAllMoves
      ? // -- TRUE: return all moves
        await this.dbaService.getAllMovesByMatchIdPromise(match._id.toString())
      : // -- FALSE (not NULL): still return match closing events if match is finished
      doReturnAllMoves !== null && match.isFinished
      ? // TODO: consider filtering events
        [await this.dbaService.getLastMoveByMatchIdPromise(match._id.toString())]
      : null;
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

  public IsAuthUserIsActivePlayer(match: model.Match, user: IUser) {
    return match?.getActivePlayerId()?.equals(user?.username);
  }
}
