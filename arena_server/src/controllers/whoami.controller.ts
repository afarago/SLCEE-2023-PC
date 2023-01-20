import { Get, Request, Route, Security, Tags } from 'tsoa';
import { Container, Inject } from 'typedi';

import SessionDataService, { SessionUserData } from '../services/sessiondata.service';

type WhoAmiIResponse = SessionUserData;

@Route('/api/whoami')
export default class WhoAmIController {
  @Inject()
  private sessionDataService: SessionDataService = Container.get(SessionDataService);

  /**
   * Returns information on authenticated User
   * @summary Returns authenticated User
   * @returns The id of the authenticated User.
   */
  @Get('/')
  @Tags('Diagnostic')
  @Security({ basic: [] })
  public async getAuthenticatedUser(@Request() req: any): Promise<WhoAmiIResponse> {
    const retval = this.sessionDataService.getUserData(req);
    return retval;
  }
}
