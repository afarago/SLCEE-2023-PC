import { Get, Path, Request, Response, Route, Security, Tags } from 'tsoa';
import { Container, Inject } from 'typedi';

import { ErrorResponse } from '../dto/errorresponse';
import { PlayerDTO } from '../dto/playerresponse';
import { APIError, playerToDTO } from '../dto/utils';
import DBAService, { ObjectIdString } from '../services/dba.service';

@Route('/api/players')
export default class PlayersController {
  @Inject()
  private dbaService: DBAService = Container.get(DBAService); // !!

  /**
   * Retrieves the details of all Players.
   * Players can retrieve only own information and details
   * @summary Retrieves Player information
   */
  @Get('/')
  @Tags('Players')
  @Security({ basic: [] })
  @Response<ErrorResponse>(401, 'Not allowed for users to query players.')
  public async getPlayers(@Request() req: any): Promise<PlayerDTO[]> {
    if (!req.user?.isAdmin) throw new APIError(401, 'Not allowed for users to query players.');
    // admin can list all users
    const items = await this.dbaService.getPlayersPromise(true);
    const dtos = items.map(playerToDTO);
    return dtos;
  }

  /**
   * Retrieves the details of an existing Player.
   * Supply the unique Player ID and receive corresponding Player details.
   * Players can retrieve only own information and details
   * @summary Retrieves a Player details
   * @param id The requested Player Id
   * @returns Player details
   */
  @Get('{id}')
  @Tags('Players')
  @Security({ basic: [] })
  @Response<ErrorResponse>(403, 'Not allowed to query other users.')
  @Response<ErrorResponse>(404, 'Player record not found.')
  public async getPlayer(@Request() req: any, @Path() id: ObjectIdString): Promise<PlayerDTO> {
    // -- guard that this is available for getting own user or all by admin
    if (!req.user?.isAdmin && req.user?.username !== id) throw new APIError(403, 'Not allowed to query other users.');

    const player = await this.dbaService.getPlayerByIdPromise(id, true);
    if (!player) throw new APIError(404, 'Player record not found.');

    const dto = playerToDTO(player);
    return dto;
  }
}
