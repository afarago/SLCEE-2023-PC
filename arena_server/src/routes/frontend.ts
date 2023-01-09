import express from 'express';
import path from 'path';

import { authedLimiter } from '../config/limiter';
import Logger from '../config/logger';
import { authenticate, authenticateWithRedirect } from '../config/passport';
import FrontendController from '../controllers/frontend.controller';
import { BaseError } from '../dto/utils';

const app = express();
export default app;

// Configure Express to use EJS
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

app.get('/', (req: any, res, next) => {
  Promise.resolve()
    .then(async () => {
      res.redirect('/matches');
    })
    .catch(next); // Errors will be passed to Express.
});

app.get('/login', authenticate, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      return res.redirect(req?.headers?.referer ?? '/matches');
    })
    .catch(next); // Errors will be passed to Express.
});

app.get('/logout', async (req: any, res, next) => {
  Promise.resolve()
    .then(async () => {
      return res.redirect(401, '/login'); // req?.headers?.referer ?? '/matches');
      // return res.status(401).location('/matches').end();
    })
    .catch(next); // Errors will be passed to Express.
});

app.get('/matches', authenticateWithRedirect, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new FrontendController();
      await controller.getMatches(req, { at: req.query.at as any, tags: req.query.tags as any }, res);
    })
    .catch(next); // Errors will be passed to Express.
});

app.get('/matches/:matchId', authenticateWithRedirect, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new FrontendController();
      await controller.getMatch(req, { matchId: req.params.matchId }, res);
    })
    .catch(next); // Errors will be passed to Express.
});

app.on('mount', async (parent) => {
  // -- instantiate controller, register for db changes - entry point for socket.io
  const controller = new FrontendController(true);
});

// -- Error handling generic middleware - you define error-handling middleware last, after other app.use() and routes calls;
app.use(function errorHandler(err: any, req: any, res: any, next: any) {
  if (!(err instanceof BaseError)) Logger.error(err.stack);
  else Logger.error(err.message);

  const status = err.statusCode || 400;
  return res.render('error', { message: err.message, error: err });
});
