import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { isTooManyTries, retryAsync } from 'ts-retry';
import { Body, Delete, Get, Path, Post, Query, Request, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { Container, Inject } from 'typedi';

import Logger from '../config/logger';
import { IUser } from '../config/passport';
import { ErrorResponse } from '../dto/errorresponse';
import { MatchCreateResponse } from '../dto/matchcreateresponse';
import { MatchHeaderFullDTO } from '../dto/matchheader';
import { MatchDTO, MatchEventDTO } from '../dto/matchresponse';
import { APIError, BoolLikeString, eventToDTO, matchToHeaderDTO, moveToDTO, parseBoolyFromString } from '../dto/utils';
import Match from '../models/game/match';
import MatchCreationParams from '../models/game/matchcreationparams';
import { OMatchEventType } from '../models/game/matchevent';
import { integer } from '../models/game/model';
import { DUMMY_PLAYER_ID } from '../models/game/player';
import UserAction, { IUserAction } from '../models/game/useraction';
import DBAService, { ObjectIdString } from '../services/dba.service';
import GameLogicService from '../services/game.logic.service';
import GameService from '../services/game.service';

dotenv.config();
const apiRetryTimeoutMs = Number(process.env.API_RETRY_TIMEOUT_MS) || 30 * 1000; // wait for 30 sec max //LATER add to dotenv config
const apiRetryDelayMs = Number(process.env.API_RETRY_DELAY_MS) || 1000; // retry every 1000 ms
// const apiRetryMaxCount = 1000; // set a meaningful, yet high retry number (above the default 10)
const apiRetryMaxCount = Math.floor(apiRetryTimeoutMs / apiRetryDelayMs) + 1;

@Route('/api/matches')
export default class MatchesController {
  // constructor(private auth: IUser, private clientip: string) {}

  @Inject()
  private dbaService: DBAService = Container.get(DBAService);
  @Inject()
  private gameService: GameService = Container.get(GameService);

  /**
   * Retrieves the details of all Matches.
   * Players will receive own matches only
   * @summary Retrieves all Matches
   * @param [at] optional filter parameter in the form of ISO date or 'today'
   * @param [active] optional filter matches where player is active at
   * @param [tags] optional filter for tag - comma separated list of values combined with or logic
   * @param [wait] optionally waits with timeout for any resulting match - useful for polling when the user receives invite for a new match to avoid polling
   * @param [id] optional filter for list of match ids - comma separated list of values combined with or logic
   * @param [limit] optional set max number of results returned
   * @param [offset] optional match id offset used for limiting
   * @param [sortasc] optional sorting order, default is descending - latest match first
   * @param [condensed] optional condensed view
   * @returns matches
   * @example at "today"
   * @example active 1
   * @example wait 1
   */
  @Get('/')
  @Tags('Game', 'GameAdmin')
  @Security({ basic: [] })
  public async getMatches(
    @Request() req: any,
    @Query() at?: string,
    @Query() active?: BoolLikeString,
    @Query() tags?: string,
    @Query() wait?: BoolLikeString,
    @Query() condensed?: BoolLikeString,
    @Query() limit?: integer,
    @Query() offset?: ObjectIdString,
    @Query() sortasc?: BoolLikeString,
    @Query() id?: string
  ): Promise<(MatchDTO | MatchHeaderFullDTO)[]> {
    // -- normal user is allowed to see its own matches only
    const filterPlayerId = !req.user?.isAdmin ? req.user?.username : null;
    const filterCurrentPlayerId = parseBoolyFromString(active) ? filterPlayerId : null;
    const doWaitForNonNull: boolean = parseBoolyFromString(wait);
    const isCondensed: boolean = parseBoolyFromString(condensed);
    const sortIdAscending: boolean = parseBoolyFromString(sortasc);
    const limitFilterObj: any = limit
      ? {
          count: limit,
          ...(offset ? { offset: offset } : {}),
        }
      : {};

    // -- set date filter if available
    let filterDate: Date;
    if (at) {
      filterDate = new Date(at);
      if (isNaN(filterDate.valueOf()) && at === 'today') filterDate = new Date();
    }

    // -- tags filter
    const filterTags = tags?.split(',');

    // -- ids filter
    const idFilter = id?.split(',');

    // -- setting up async worker to retrieve the result
    const fnWorker = async () => {
      const matches = await this.dbaService.getMatchesPromise({
        playerId: filterPlayerId,
        activePlayerId: filterCurrentPlayerId,
        date: filterDate,
        tags: filterTags,
        limit: limitFilterObj,
        sortAscending: sortIdAscending,
        id: idFilter,
      });
      return matches;
    };

    // -- retrieve result - if doWaitForActive is false - we only retry once
    const matches = !doWaitForNonNull
      ? await fnWorker()
      : await retryAsync(fnWorker, {
          // -- retry executing the action either until auth user is same as current user or timeout
          delay: apiRetryDelayMs,
          maxTry: apiRetryMaxCount,
          until: (retval) => retval?.length > 0, // end criteria - any matches are returned
        }).catch(() => [] as Match[]); // -- do not throw any errors, just default

    const result = await matches.reduce(
      async (
        accPromise: Promise<(MatchDTO | MatchHeaderFullDTO)[]>,
        match: Match
      ): Promise<(MatchDTO | MatchHeaderFullDTO)[]> => {
        const acc = await accPromise;
        try {
          if (!isCondensed) {
            const dto = await this.gameService.getMatchDTOPromise(match, { user: req.user });
            acc.push(dto);
          } else {
            const playerObjs = await this.dbaService.getPlayersPromise();
            const dto = matchToHeaderDTO(match, playerObjs) as MatchHeaderFullDTO;
            acc.push(dto);
          }
        } catch {
          // -- NOOP
        }
        return acc;
      },
      Promise.resolve(new Array<MatchDTO | MatchHeaderFullDTO>())
    );
    return result;
  }

  /**
   * Creates a new Match using the supplied parameters, leave empty for a default 'practice' Match.
   * @summary Creates a new Match
   * @param params Match creation parameters including players, drawpile, discardpile, banks and randomseed
   * @returns The newly created Match id
   * @example params { }
   * @example params { "drawPile": [ ["Oracle", 4], ["Anchor", 4], ["Mermaid", 5] ], "discardPile":[ ["Mermaid", 2], ["Hook", 2] ] }
   */
  @Post('/')
  @Tags('Game', 'GameAdmin')
  @Security({ basic: [] })
  @Response<ErrorResponse>(400, 'Missing players from input parameters.')
  @Response<ErrorResponse>(
    400,
    'Start a match with your player id twice or your player and the dummy player to start a practice match.'
  )
  @Response<ErrorResponse>(500, 'Internal Server Error.')
  public async createMatch(@Request() req: any, @Body() params: MatchCreationParams): Promise<MatchCreateResponse> {
    // -- anyone can generate a practice match with an empty array (two instances of playing by himself).
    if (!params.playerids || !Array.isArray(params.playerids)) {
      if (!req.user?.isAdmin) {
        params.playerids = [req.user?.username, req.user?.username];
      } else {
        throw new APIError(400, 'Missing players from input parameters.');
      }
    }

    // -- admin can create any match
    // -- player can create match for itself only (playing against itself using two identical 'me' players)
    // -- anyone can start a match agains the dummy user
    if (
      !req.user?.isAdmin &&
      !params.playerids.every((p: ObjectIdString) => p === req.user?.username || p === DUMMY_PLAYER_ID)
    ) {
      throw new APIError(
        400,
        'Start a match with your player id twice or your player and the dummy player to start a practice match.'
      );
    }

    // -- create the match
    const executor = new GameLogicService(null, req.user?.username, req.res.locals.clientip);
    const match = await executor.actionStartMatchPromise(
      req.user?.isAdmin ? null : new ObjectId(req.user?.username),
      params
    );
    if (!match) throw new APIError(500, 'Match creation failed.');

    // TODO: consider returning the match object as matchdto
    return { id: match._id.toString(), randomSeed: params.randomSeed };
  }

  /**
   * Retrieves the details of an existing match.
   * Supply the unique match ID and receive corresponding match details.
   * @summary Retrieves a Match details
   * @param id The requested Match Id
   * @param [waitactive] optionally waits with timeout until user becomes active
   * @param [showevents] optionally add events associated with the match
   * @param [showdebug] optionally expose additional info not availble for tournament matches such as drawpile, discardpile contents
   * @returns Match details, with al details when requesting a 'practice' Match
   */
  @Get('{id}')
  @Tags('Game', 'GameAdmin')
  @Security({ basic: [] })
  @Response<ErrorResponse>(401, 'Match is visible to participating players only.')
  @Response<ErrorResponse>(404, 'Match does not exist.')
  @Response<ErrorResponse>(409, 'Authenticated user is not the current player.')
  @Response<MatchDTO>(410, 'No action possible on finished matches.')
  @Response<ErrorResponse>(500, 'Internal Server Error.')
  public async getMatch(
    @Request() req: any,
    @Path() id: ObjectIdString,
    @Query() waitactive?: BoolLikeString,
    @Query() showevents?: BoolLikeString,
    @Query() showdebug?: BoolLikeString,
    @Query() condensed?: BoolLikeString
  ): Promise<MatchDTO | MatchHeaderFullDTO> {
    const doWaitForActive: boolean = parseBoolyFromString(waitactive);
    const doShowEvents: boolean = parseBoolyFromString(showevents);
    const doShowDebug: boolean = parseBoolyFromString(showdebug);
    const isCondensed: boolean = parseBoolyFromString(condensed);

    // -- setting up async worker to retrieve the result
    const match = await this.getMatchWithValidationAndOptionalWait(id, doWaitForActive, req.user, true);

    // -- construct DTO object
    let dto = null;
    if (!isCondensed) {
      const playerObjs = await this.dbaService.getPlayersPromise();
      const playerNames = match.playerids.map((pid) => playerObjs.get(pid.toString())?.name ?? '');
      dto = await this.gameService.getMatchDTOPromise(match, {
        user: req.user,
        doReturnAllMoves: doShowEvents,
        doAddDebug: doShowDebug,
        playerNames,
      });
    } else {
      const playerObjs = await this.dbaService.getPlayersPromise();
      dto = matchToHeaderDTO(match, playerObjs) as MatchHeaderFullDTO;
    }

    if (doWaitForActive && match.isFinished) throw new APIError(410, 'No action possible on finished matches.', dto);
    if (doWaitForActive && !this.gameService.IsAuthUserIsActivePlayer(match, req.user))
      throw new APIError(409, 'Authenticated user is not the current player.');

    return dto;
  }

  /**
   * Execute an Action for an existing Match.
   * Supply the unique match ID and add Action details
   * @summary Execute an Action for a Match
   * @param params Match action execution parameters
   * @param [wait] optionally waits with timeout executing the action - useful for waiting for other user to finish its action to avoid polling
   * @returns List of Response events executed in response for the Action
   * @example params { "etype": "Draw" }
   * @example params { "etype": "EndTurn" }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Oracle", "card": ["Mermaid", 5] } }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Oracle", "card": null } }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Hook", "card": ["Mermaid", 5] } }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Cannon", "card": ["Mermaid", 5] } }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Sword", "card": ["Mermaid", 5] } }
   * @example params { "etype": "ResponseToEffect", "effect": { "effectType": "Map", "card": ["Mermaid", 5] } }
   * @example params { "etype": "ResponseToEffect", "autopick": true }
   * @example params { "etype": "Draw", "autopick": true }
   * @example params { "etype": "EndTurn", "autopick": true }
   * @example wait 1
   */
  @Post('{id}')
  @Tags('Game')
  @Security({ basic: [] })
  @Response<ErrorResponse>(400, 'Invalid useraction input parameter.')
  @Response<ErrorResponse>(401, 'Match is visible only to participating players.')
  @Response<ErrorResponse>(404, 'Match does not exist.')
  @Response<ErrorResponse>(409, 'Authenticated user is not the current player.')
  @Response<MatchEventDTO[]>(410, 'No action possible on finished matches.')
  @Response<ErrorResponse>(500, 'Internal Server Error.')
  public async executeActionForMatch(
    @Request() req: any,
    @Path() id: ObjectIdString,
    @Body() params: IUserAction,
    @Query() wait?: BoolLikeString
  ): Promise<MatchEventDTO[]> {
    if (req.user?.isAdmin) throw new APIError(401, 'Admin user is not allowed to interfere with the match.'); // admin user is not allowed
    const data = UserAction.constructFromObject(params);
    if (!data) throw new APIError(400, 'Invalid useraction input parameter.');
    const doWaitForExecution: boolean = parseBoolyFromString(wait);

    // -- setting up async worker to retrieve the result
    const match = await this.getMatchWithValidationAndOptionalWait(id, doWaitForExecution, req.user, false);

    if (match.isFinished) {
      // -- add last move (match finished) events turnended and matchended
      const move = await this.dbaService.getLastMoveByMatchIdPromise(match._id.toString());
      const events = move
        ?.getEvents()
        .filter(
          (event) => event?.eventType === OMatchEventType.TurnEnded || event?.eventType === OMatchEventType.MatchEnded
        );
      throw new APIError(410, 'No action possible on finished matches.', {
        events: events?.map((event) => eventToDTO(event, { hidePlayerIndex: true })),
      });
    }
    if (!this.gameService.IsAuthUserIsActivePlayer(match, req.user))
      throw new APIError(409, 'Authenticated user is not the current player.');

    // -- execute action promise if all is good
    const executor = new GameLogicService(match, req.user?.username, req.res.locals.clientip);
    const move = await executor.actionExecuteUserActionPromise(data);
    if (!move) throw new APIError(500, 'Error processing request.');

    const movedto = moveToDTO(move, { hidePlayerIndex: true });
    return movedto.events;
    // TODO: consider changing return type to MoveDTO
  }

  /**
   * Retrieves a match with validations and optionally retrying and waiting
   * @param id
   * @param doWaitForExecution
   * @param user
   * @returns match
   */
  private async getMatchWithValidationAndOptionalWait(
    id: string,
    doWaitForExecution: boolean,
    user: IUser,
    doAllowAdmin: boolean
  ): Promise<Match> {
    const fnWorker = async () => {
      return await this.dbaService.getMatchByIdPromise(id);
    };

    // TODO: improvement potential -- use the watch stream to avoid the polling

    // -- retrieve result - if doWaitForActive is false - we only retry once
    const match: Match | undefined = !doWaitForExecution
      ? await fnWorker()
      : await retryAsync(fnWorker, {
          // -- retry executing the action either until auth user is same as current user or timeout
          delay: apiRetryDelayMs,
          maxTry: apiRetryMaxCount,
          until: (retval) => !retval || retval.isFinished || this.gameService.IsAuthUserIsActivePlayer(retval, user),
        }).catch((e) => (isTooManyTries(e) ? e.getLastResult() : undefined)); // -- do not throw any errors, just default

    // -- check if current user is adequate
    if (!match) throw new APIError(404, 'Match does not exist.');
    if (!(doAllowAdmin && user?.isAdmin) && !match.playerids.some((p) => p?.equals(user?.username)))
      throw new APIError(401, 'Match is visible only to participating players.');
    return match;
  }

  /**
   * Forceful deletion of a Match
   * @summary Forceful deletion of a Match
   * @param id game id
   * @param winnerId winning player Id
   * @param [comment] termination comment
   */
  @Delete('{id}/terminate')
  @Tags('Game', 'GameAdmin')
  @Security({ basic: [] })
  @Response<ErrorResponse>(401, 'Not authorized to perform action.')
  @Response<ErrorResponse>(404, 'Match does not exist.')
  @SuccessResponse(200)
  public async deleteMatch(
    @Request() req: any,
    @Path() id: ObjectIdString,
    @Body() params: { winnerId: ObjectIdString; comment?: string }
  ): Promise<MatchDTO> {
    const match = await this.dbaService.getMatchByIdPromise(id);
    if (!match) throw new APIError(404, 'Match does not exist.');

    // -- admin can terminate any match
    // -- player can terminate a practive match (every playerid is either 'me' player or dummy playyer)
    // -- dummy player cannot terminate any matches
    if (
      !req.user?.isAdmin &&
      !(
        req.user?.username !== DUMMY_PLAYER_ID &&
        match.playerids.every((p) => p?.equals(req.user?.username) || p?.equals(DUMMY_PLAYER_ID))
      )
    ) {
      throw new APIError(401, 'Not authorized to perform action.');
    }

    const executor = new GameLogicService(match, req.user?.username, req.res.locals.clientip);
    await executor.actionDeleteMatchPromise(new ObjectId(params.winnerId), params.comment);

    const dto = await this.gameService.getMatchDTOPromise(match, { user: req.user });
    return dto;
  }

  /**
   * Forceful central deletion of a match using a watchdog on timeout
   * @summary Forceful central deletion of a match using a watchdog on timeout
   * @param [tags] optional filter matches with matching tag/comma separated list of tags
   * @returns
   */
  @Post('watchdog')
  @Tags('GameAdmin')
  @Security({ basic: [] })
  @Response<ErrorResponse>(401, 'Not authorized to perform action.')
  public async watchDogMatches(@Request() req: any, @Query() tags?: string): Promise<MatchDTO[]> {
    if (!req.user?.isAdmin) throw new APIError(401, 'Not authorized to perform action.');

    // -- tags filter
    const filterTags = tags?.split(',');

    // -- retrieve matches
    const matches = await this.dbaService.getMatchesPromise({
      checkNotFinished: true,
      checkTimeoutExpired: true,
      tags: filterTags,
    });

    // -- iterate through (w error handling) all matches where timeout is due
    const results: MatchDTO[] = [];
    for (const match of matches) {
      try {
        // -- terminate match on watchdog, with default timeout comment
        // -- this will double check if timeout really happened & also centralize timeout logic
        const executor = new GameLogicService(match, req.user?.username, req.res.locals.clientip);
        if (await executor.checkTimeoutAndAutoTerminatePromise()) {
          const dto = await this.gameService.getMatchDTOPromise(match, { user: req.user });
          results.push(dto);
        }
      } catch (ex) {
        Logger.info(`Error deleting match [${match?._id}] ${ex.message ?? ex}`);
      }
    }

    return results;
  }

  /**
   * Return the Busy days for any match exists
   * @param req
   * @param input
   * @returns match statistics busy days
   */
  @Get('busydays')
  @Tags('Game')
  @Security({ basic: [] })
  @Response<ErrorResponse>(401, 'Not authorized to perform action.')
  public async getMatchStatisticsBusyDays(@Request() req: any, @Query() at?: string): Promise<string[]> {
    // TODO: should consider filters as well (tags)
    const adate = at ? new Date(at) : new Date();
    const dateFrom = new Date(adate.getFullYear(), adate.getMonth(), 1 - 7);
    const dateToExcl = new Date(adate.getFullYear(), adate.getMonth() + 1, 1 + 7);
    const playerid = !req.user?.isAdmin ? req.user?.username : undefined;
    const dayCounts = await this.dbaService.getMatchCountForDateRange(dateFrom, dateToExcl, playerid);
    return dayCounts.map((item) => item.day.toDateString());
  }
}
