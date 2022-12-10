import { Get, Request, Route, Security, Tags } from 'tsoa';
import { IUser } from '../config/passport';

type WhoAmiIResponse = { username: string; name: string; ip: string };

@Route('/api/whoami')
export default class WhoAmIController {
  /**
   * Returns information on authenticated User
   * @summary Returns authenticated User
   * @returns The id of the authenticated User.
   */
  @Get('/')
  @Tags('Diagnostic')
  @Security({ basic: [] })
  public async getAuthenticatedUser(@Request() req: any): Promise<WhoAmiIResponse> {
    const user: IUser = req.user;
    return {
      username: user?.username,
      name: user?.name,
      ip: req.res.locals.clientip,
    };
  }
}
