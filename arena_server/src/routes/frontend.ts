import express from 'express';
import path from 'path';
import { Container } from 'typedi';

import Logger from '../config/logger';
import { authenticate, authenticateOptionally } from '../config/passport';
import FrontendController from '../controllers/frontend.controller';
import { BaseError } from '../dto/utils';
import DbService from '../services/db.service';

const app = express();
export default app;

// Configure Express to use EJS
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

app.get('/', (req: any, res) => {
  res.redirect('/matches');
});

app.get('/login', authenticate, async (req: any, res, next) => {
  return res.redirect(req?.headers?.referer ?? '/matches');
});

app.get('/logout', async (req: any, res, next) => {
  return res.redirect(401, req?.headers?.referer ?? '/matches');
  return res.status(401).location('/matches').end();
});

app.get('/matches', authenticateOptionally, async (req: any, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new FrontendController();
      await controller.getMatches(req, { at: req.query.at, tags: req.query.tags }, res);
    })
    .catch(next); // Errors will be passed to Express.
});

app.get('/matches/:matchId', authenticateOptionally, async (req: any, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new FrontendController();
      await controller.getMatch(req, { matchId: req.params.matchId }, res);
    })
    .catch(next); // Errors will be passed to Express.
});

app.on('mount', async (parent) => {
  // -- subscribe to change streams so app can react on frontend
  const dbService = Container.get(DbService);
  const controller = new FrontendController();
  await dbService.monitorMatchesPromise(controller.callbackMatchChangedPromise.bind(controller));
  await dbService.monitorMovesPromise(controller.callbackMoveChangedPromise.bind(controller));
  await dbService.monitorPlayersPromise(controller.callbackPlayersChangedPromise.bind(controller));
});

// -- Error handling generic middleware - you define error-handling middleware last, after other app.use() and routes calls;
app.use(function errorHandler(err: any, req: any, res: any, next: any) {
  if (!(err instanceof BaseError)) Logger.error(err.stack);
  else Logger.error(err.message);

  const status = err.statusCode || 400;
  return res.render('error', { message: err.message, error: err });
});
