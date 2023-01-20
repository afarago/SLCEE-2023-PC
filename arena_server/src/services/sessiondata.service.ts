import 'reflect-metadata';

import { Container, Inject, Service } from 'typedi';

import { IUser } from '../config/passport';
import DbService from './db.service';

export type SessionUserData = {
  username: string;
  name: string | null;
  role: string | null;
};

export type SessionData = {
  username: string;
  name: string | null;
  role: string | null;
  dbname: string;
  ip: string;
};

@Service()
export default class SessionDataService {
  @Inject()
  private dbService: DbService = Container.get(DbService);

  public getSessionData(req: any): SessionData {
    const user: IUser = req.user;
    return {
      username: user?.username,
      name: user?.name ?? null,
      role: this.getUserRole(user),
      dbname: this.dbService?.databaseName,
      ip: req.res.locals.clientip,
    };
  }

  public getUserData(req: any): SessionUserData {
    const user: IUser = req.user;
    return {
      username: user?.username,
      name: user?.name ?? null,
      role: this.getUserRole(user),
    };
  }

  private getUserRole(user: IUser | undefined) {
    if (!user) return null;
    return user.isAdmin ? 'admin' : 'player';
  }
}
