import * as express from 'express';
import { Container } from 'typedi';
import DbService from '../services/db.service';
import DBAService from '../services/dba.service';

export const register = (app: express.Application) => {
  // === GOOGLE Warmup ==================
  app.get('/_ah/warmup', (req, res) => {
    // Handle your warmup logic. Initiate db connection, etc.
    const dbService = Container.get(DbService);
    const dbaService = Container.get(DBAService);
    dbService.ensureConnected();
    dbaService.getPlayersCache();
    res.sendStatus(200);
  });
};
