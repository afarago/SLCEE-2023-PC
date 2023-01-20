import { Get, Request, Route, Security, Tags } from 'tsoa';
import { Container, Inject } from 'typedi';

import SessionDataService, { SessionData } from '../services/sessiondata.service';

type SessionInfoResponse = SessionData;

@Route('/api/sessioninfo')
export default class SessionInfoController {
  @Inject()
  private sessionDataService: SessionDataService = Container.get(SessionDataService);

  /**
   * Returns generic information on session
   * @summary Returns session information
   * @returns The user, database, ip information.
   */
  @Get('/')
  @Tags('Diagnostic')
  @Security({ basic: [] })
  public async getSessionInfo(@Request() req: any): Promise<SessionInfoResponse> {
    const retval = this.sessionDataService.getSessionData(req);
    return retval;
  }
}
