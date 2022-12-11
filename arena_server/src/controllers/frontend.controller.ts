import { Container, Inject } from 'typedi';

import Logger from '../config/logger';
import { matchToHeaderDTO, moveToDTO } from '../dto/utils';
import * as model from '../models/game/model';
import DbService from '../services/db.service';
import DBAService, { ObjectIdString } from '../services/dba.service';
import GameService from '../services/game.service';
import SocketIOService from '../services/socketio.service';

export default class FrontendController {
  @Inject()
  private dbService: DbService = Container.get(DbService); // !! //TODO: should work out of the box, still for manyal construction does not
  @Inject()
  private dbaService: DBAService = Container.get(DBAService);
  @Inject()
  private gameService: GameService = Container.get(GameService);
  @Inject()
  private socketIOService: SocketIOService = Container.get(SocketIOService);

  /**
   * Render matches for Frontend
   * @param filter
   * @param res
   * @returns matches
   */
  public async getMatches(req: any, filter: { at?: string; tags?: string }, res: any): Promise<void> {
    res.locals.databaseName = this.dbService?.databaseName;
    res.locals.user = req.user;

    let filterDate = new Date(); // -- just today
    if (filter.at) {
      const tempdate = new Date(filter.at + 'UTC');
      if (!isNaN(tempdate.valueOf())) filterDate = tempdate;
    }
    const filterTags = filter.tags ? filter.tags.split(',') : undefined;

    const limit = 100; // -- db will return 100+1, indicating we have more available
    const matches = await this.dbaService.getMatchesPromise({
      playerId: !req.user?.isAdmin ? req.user?.username : undefined,
      date: filterDate,
      tags: filterTags,
      limit: {
        // !! startId
        count: limit,
      },
    });

    // const playeridstrings = matches.reduce(
    //   (acc, match) => match.playerids.reduce((acc, pid) => acc.add(pid.toString()), acc),
    //   new Set<string>()
    // );
    // const playerobjs = await this.dbaService.getPlayerByIdsPromise([...playeridstrings]);
    // const playerobjs = await this.dbaService.getPlayersPromise();
    // const players: Map<string, model.Player> = playerobjs?.reduce(
    //   (prev, current) => prev.set(current._id.toString(), current),
    //   new Map<string, model.Player>()
    // );
    const players = await this.dbaService.getPlayersCache();
    const matchesOnLoad = matches
      ?.map((match) => {
        try {
          return matchToHeaderDTO(match, players);
        } catch {
          // -- NOOP
        }
      })
      ?.filter((matchdata) => matchdata);

    res.render('matches', { filterDate, matchesOnLoad, limit });
  }

  /**
   * Return the Busy days for any match exists
   * @param req
   * @param input
   * @returns match statistics busy days
   */
  public async getMatchStatisticsBusyDays(req: any, input: Date): Promise<string[]> {
    // TODO: should consider filters as well (tags)
    // TODO: DEVELOPMENT IN PROGRESS temp route for calendar statistics
    const adate = new Date(input);
    const dateFrom = new Date(adate.getFullYear(), adate.getMonth(), 1 - 7);
    const dateToExcl = new Date(adate.getFullYear(), adate.getMonth() + 1, 1 + 7);
    const playerid = req.user?.username;
    const dayCounts = await this.dbaService.getMatchCountForDateRange(dateFrom, dateToExcl, playerid);
    return dayCounts.map((item) => item.day.toDateString());
  }

  /**
   * Render match for Frontend
   * @param id
   * @param filter
   * @param res
   * @returns match
   */
  public async getMatch(req: any, filter: { matchId: ObjectIdString }, res: any): Promise<void> {
    res.locals.databaseName = this.dbService?.databaseName;
    res.locals.user = req.user;

    const match = await this.dbaService.getMatchByIdPromise(filter?.matchId);
    if (!match) throw new Error('Match does not exist.');

    const _playerobjs = await this.dbaService.getPlayersCache();
    const playernames = match.playerids.map((pid) => _playerobjs.get(pid.toString())?.name ?? '');
    const matchdto = await this.gameService.getMatchDTOPromise(match, {
      user: req.user,
      playerNames: playernames,
      doReturnAllMoves: true,
    });

    res.render('match', { matchdto });
  }

  // ------------------------------------------------------------------------------
  // -- database change stream watch functions

  /**
   * Callbacks on match changed
   * @param id
   * @param operationType
   * @param item
   */
  public async callbackMatchChangedPromise(id: ObjectIdString, operationType: string, item: any) {
    try {
      if (!this.socketIOService.connectCounter) return; // -- optimization point: just dont don't send anything if there are no clients connected

      if (operationType === 'replace' || operationType === 'update' || operationType === 'insert') {
        const playerObjs = await this.dbaService.getPlayersCache();
        // -- 'update' is missing important fields --> should read from db->async cannot store in a transient state in res.local (as we are in multiple nodes)
        const match = item.hasOwnProperty('fullDocument')
          ? model.Match.constructFromObject(item.fullDocument)
          : await this.dbaService.getMatchByIdPromise(id);
        if (!match) throw new Error('Match not found or constructable from Db object');

        // -- header
        {
          const emitdata = matchToHeaderDTO(match, playerObjs);
          if (emitdata) {
            const emitroom = `date_${match.startedAt.toJSON().split('T')[0]}`;
            this.socketIOService.emitMessage('match:update:header', emitroom, emitdata);
          }
        }

        // -- details
        {
          // TODO: to be handled based on user
          const emitdata = await this.gameService.getMatchDTOPromise(match);
          if (emitdata) {
            const emitroom = `match_${match._id.toString()}`;
            this.socketIOService.emitMessage('match:update:details', emitroom, emitdata);
          }
        }
      }
    } catch (e) {
      Logger.error(e.message);
    }
  }

  /**
   * Callbacks move changed
   * @param id
   * @param operationType
   * @param item
   */
  public async callbackMoveChangedPromise(id: ObjectIdString, operationType: string, item: any) {
    try {
      if (!this.socketIOService.connectCounter) return; // -- optimization point: just dont don't send anything if there are no clients connected

      if (operationType === 'insert') {
        const move = model.Move.constructFromObject(item.fullDocument);
        if (!move) throw new Error('Cannot construct move from Db Object');

        const isDebug = false; // TODO: to be handled based on user

        const movedto = moveToDTO(move, { isDebug });
        if (movedto) {
          const emitroom = `match_${move.matchId.toString()}`;
          this.socketIOService.emitMessage('move:insert:details', emitroom, movedto);
        }
      }
    } catch (e) {
      Logger.error(e.message);
    }
  }

  /**
   * Callbacks players changed
   * @param id
   * @param operationType
   * @param item
   */
  public async callbackPlayersChangedPromise(id: ObjectIdString, operationType: string, item: any) {
    // -- invalidate players' cache, do it even if noone is connected
    this.dbaService.resetPlayersCache();
    await this.dbaService.getPlayersCache();
  }
}
