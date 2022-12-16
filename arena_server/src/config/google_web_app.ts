import * as express from 'express';
import { Container } from 'typedi';
import DbService from '../services/db.service';
import DBAService from '../services/dba.service';

export const register = (app: express.Application) => {
  // === GOOGLE Warmup ==================
  app.get('/_ah/warmup', async (req, res) => {
    // Handle your warmup logic. Initiate db connection, etc.
    const dbService = Container.get(DbService);
    const dbaService = Container.get(DBAService);
    dbService.ensureConnected();
    //-- this will fill up the cache
    await dbaService.getPlayersPromise();
    res.sendStatus(200);
  });
};
