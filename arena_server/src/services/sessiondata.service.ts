import 'reflect-metadata';

import { Container, Inject, Service } from 'typedi';

import { IUser } from '../config/passport';
import DbService from './db.service';

export type SessionData = { dbname: string; username: string; name: string | null; role: string | null };

@Service()
export default class SessionDataService {
  @Inject()
  private dbService: DbService = Container.get(DbService);

  public getSessionData(req: any): SessionData {
    const user: IUser = req.user;
    return {
      username: user?.username,
      name: user?.name ?? null,
      role: user ? (user.isAdmin ? 'admin' : 'player') : null,
      dbname: this.dbService?.databaseName,
    };
  }
}
