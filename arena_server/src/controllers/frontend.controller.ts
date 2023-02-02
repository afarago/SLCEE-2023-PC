import { Container, Inject } from 'typedi';

import Logger from '../config/logger';
import { matchToHeaderDTO, moveToDTO } from '../dto/utils';
import * as model from '../models/game/model';
import DbService from '../services/db.service';
import DBAService, { ObjectIdString } from '../services/dba.service';
import GameService from '../services/game.service';
import SessionDataService from '../services/sessiondata.service';
import SocketIOService from '../services/socketio.service';

export default class FrontendController {
  @Inject()
  private dbService: DbService = Container.get(DbService);
  @Inject()
  private dbaService: DBAService = Container.get(DBAService);
  @Inject()
  private gameService: GameService = Container.get(GameService);
  @Inject()
  private socketIOService: SocketIOService = Container.get(SocketIOService);
  @Inject()
  private sessionDataService: SessionDataService = Container.get(SessionDataService);

  constructor(doRegisterToDbChanges: boolean = false) {
    if (doRegisterToDbChanges) {
      // -- subscribe to change streams so app can react on frontend
      this.dbaService.onMatchesChanged.on('changed', this.handleMatchChangedPromise.bind(this));
      this.dbaService.onMovesChanged.on('changed', this.handleMoveChangedPromise.bind(this));
    }
  }

  /**
   * Render matches for Frontend
   * @param filter
   * @param res
   * @returns matches
   */
  async getMatches(req: any, filter: { at?: string; tags?: string }, res: any): Promise<void> {
    res.locals.sessionData = this.sessionDataService.getSessionData(req);
    res.locals.user = req.user;

    let filterDate = new Date(); // -- just today
    if (filter.at) {
      const tempdate = new Date(filter.at);
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
    const players = await this.dbaService.getPlayersPromise();
    const matchesOnLoad = matches
      ?.map((match) => {
        try {
          return matchToHeaderDTO(match, players);
        } catch {
          // -- NOOP
        }
      })
      ?.filter((matchdata) => matchdata);

    res.render('match_list', { filterDate, matchesOnLoad, limit });
  }

  /**
   * Render match for Frontend
   * @param id
   * @param filter
   * @param res
   * @returns match
   */
  async getMatch(req: any, filter: { matchId: ObjectIdString }, res: any): Promise<void> {
    res.locals.sessionData = this.sessionDataService.getSessionData(req);
    res.locals.user = req.user;

    const match = await this.dbaService.getMatchByIdPromise(filter?.matchId);
    if (!match) throw new Error('Match does not exist.');

    const _playerobjs = await this.dbaService.getPlayersPromise();
    const playernames = match.playerids.map((pid) => _playerobjs.get(pid.toString())?.name ?? '');
    const matchdto = await this.gameService.getMatchDTOPromise(match, {
      user: req.user,
      playerNames: playernames,
      doReturnAllMoves: true,
    });

    res.render('match_detail', { matchdto });
  }

  /**
   * Render matches for Frontend
   * @param filter
   * @param res
   * @returns matches
   */
  async getMatchStatistics(req: any, filter: { at?: string; tag: string }, res: any): Promise<void> {
    res.locals.sessionData = this.sessionDataService.getSessionData(req);
    res.locals.user = req.user;

    // let filterDate = new Date(); // -- just today
    // if (filter.at) {
    //   const tempdate = new Date(filter.at);
    //   if (!isNaN(tempdate.valueOf())) filterDate = tempdate;
    // }
    const filterTag: string = filter.tag;

    const limit = 500;
    const statsOnLoad = filterTag
      ? await this.dbaService.getMatchStatisticsPromise({ tag: filterTag, limit: limit + 1 })
      : [];
    const players = await this.dbaService.getPlayersPromise();
    res.render('match_stats', { players, statsOnLoad, filterTag, limit });
  }

  // ------------------------------------------------------------------------------
  // -- database change stream watch functions

  /**
   * Callbacks on match changed
   * @param id
   * @param operationType
   * @param item
   */
  private async handleMatchChangedPromise(match: model.Match) {
    try {
      if (!this.socketIOService.connectCounter) return; // -- optimization point: just dont don't send anything if there are no clients connected
      const playerObjs = await this.dbaService.getPlayersPromise();
      // -- header
      {
        const emitdata = matchToHeaderDTO(match, playerObjs);
        if (emitdata) {
          const datestr = `date_${match.startedAt.toLocaleDateString('en-CA')}`;
          // const userprefix = `(${match.playerids.map((pid) => pid.toString()).join('|')})`;
          // const roomstr = `\/${userprefix}\\.date_${datestr}`;
          // const emitnamespaces = new RegExp(roomstr);    // -- todo: add *.

          /*
            handle socket.io selective transport based on user auth
            match update on 424242 for user1+user2
            also todo auth user on room join

            list> on page 2022-12-15    --> deliver to "(all|user1|user2).match_424242" // does matter
            unauth: join all.date_2022-12-15  --> deliver
            user1:  join user1.date_2022-12-15 --> deliver as involved
            user3:  join user3.date_2022-12-15 --> skip as not involved

            detail> on match 424242     --> deliver to "(all).match_424242" // does not matter
            unauth: join room all.match_424242   --> deliver
            user1:  join room user1.match_424242 --> deliver
            user3:  join room user3.match_424242 --> deliver
          */

          // -- emit message in generic room : *.date_ and all players' rooms player1.date_ and player2.date_
          const emitrooms = ['admin']
            .concat(match.playerids.map((pid) => pid.toString()))
            .filter((val, idx, arr) => arr.findIndex((val2) => val === val2) == idx) // -- unique
            .map((pid) => `${pid.toString()}.${datestr}`);
          // this.socketIOService.emitMessage('match:update:header', emitnamespaces, emitdata)
          emitrooms.forEach((emitroom) => this.socketIOService.emitMessage('match:update:header', emitroom, emitdata));
        }
      }

      // -- details
      {
        const emitdata = await this.gameService.getMatchDTOPromise(match);
        if (emitdata) {
          const emitroom = `match_${match._id.toString()}`;
          this.socketIOService.emitMessage('match:update:details', emitroom, emitdata);
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
  private async handleMoveChangedPromise(move: model.Move) {
    try {
      if (!this.socketIOService.connectCounter) return; // -- optimization point: just dont don't send anything if there are no clients connected

      const isDebug = false; // TODO: to be handled based on user

      const movedto = moveToDTO(move, { isDebug });
      if (movedto) {
        const emitroom = `match_${move.matchId.toString()}`;
        this.socketIOService.emitMessage('move:insert:details', emitroom, movedto);
      }
    } catch (e) {
      Logger.error(e.message);
    }
  }
}
