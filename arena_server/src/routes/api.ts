import express from 'express';
import { ValidateError } from 'tsoa';

import Logger from '../config/logger';
import { authenticate, authenticateOptionally, ensureAdmin } from '../config/passport';
import FrontendController from '../controllers/frontend.controller';
import HelloController from '../controllers/hello.controller';
import MatchesController from '../controllers/match.controller';
import PlayersController from '../controllers/players.controller';
import WhoAmIController from '../controllers/whoami.controller';
import { BaseError } from '../dto/utils';
import { fnSetMapSerializer } from '../utils/json.utils';
import * as util from 'util';

const app = express();
export default app;

// Configure Express to parse incoming JSON data
// strict:Enables or disables only accepting arrays and objects; when disabled will accept anything JSON.parse accepts.
// reviver: The reviver option is passed directly to JSON.parse as the second argument. You can find more information on this argument in the MDN documentation about JSON.parse.
app.use(express.json());

// -- set serialization for Map and Set types on return (res.json)
app.set('json replacer', fnSetMapSerializer);

// -- set clientip from x-forwarded-for or remote address
app.use((req, res, next) => {
  res.locals.clientip =
    // GCLOUD: The user's IP address is available in the standard X-Forwarded-For header.
    req.headers['x-forwarded-for']?.toString()?.split(',')?.[0] || req.socket.remoteAddress;
  next();
});

// -- Hello endpoint handler
app.route('/api/hello').get(async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new HelloController();
      const response = await controller.getMessage();

      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});

// -- WhoAmI endpoint handler: for any auth user
app.route('/api/whoami').get(authenticate, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new WhoAmIController();
      const response = await controller.getAuthenticatedUser(req);
      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});

// -- Matches endpoint
app
  .route('/api/matches')
  // -- Retrieve list of Match handler: for admins show all, for players show only matches with involvement
  .get(authenticate, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.getMatches(
          req,
          req.query.at,
          req.query.active,
          req.query.tags,
          req.query.wait
        );
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  })

  // -- Create new Match handler: for both users (when this user is in the list of users) and admins
  .post(authenticate, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.createMatch(req, req.body);
        res.set('X-Result-Id', response.id);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// TODO: DEVELOPMENT IN PROGRESS temp route for calendar statistics
app.route('/api/matches/busydays').get(authenticateOptionally, async (req: any, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new FrontendController();
      const response = await controller.getMatchStatisticsBusyDays(req, req.query.at);
      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});
//  /matches/statistics?from=12/1/2022&to=12/31/2022&tags=alma,korte&status=finished|active
//    implicit filter by player or admin
// Csaba: tournament stats: tag+(?date)=>[winnerid,scores]
// calendar picker: filterset(tags,date+-range,(user)) => day/count

// -- Matches/{id} endpoint
app
  .route('/api/matches/:id')

  // -- Retrieve basic info about Match: for admins and participating players only
  .get(authenticate, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.getMatch(req, req.params.id, req.query.waitactive, req.query.showevents);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  })

  // -- Execute action for Match: for participating players only
  .post(authenticate, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.executeActionForMatch(req, req.params.id, req.body, req.query.wait);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- matches/{id}/terminate endpoint
app
  .route('/api/matches/:id/terminate')
  // -- Delete a Match forcefully: for admin only
  .delete(authenticate, ensureAdmin, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.deleteMatch(req, req.params.id, req.body);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- players endpoint
app
  .route('/api/players')
  // -- Retrieve all players: for admin only
  .get(authenticate, ensureAdmin, async (req: any, res: any, next: any) => {
    Promise.resolve()
      .then(async () => {
        const controller = new PlayersController();
        const response = await controller.getPlayers(req);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- players/{id} endpoint
app
  .route('/api/players/:id')
  // -- Retrieve player by id action for Match: for admin (about any player) and players (about itself)
  .get(authenticate, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new PlayersController();
        const response = await controller.getPlayer(req, req.params.id);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- Error handling generic middleware - you define error-handling middleware last, after other app.use() and routes calls;
app.use(function errorHandler(err: any, req: any, res: any, next: any) {
  if (!(err instanceof BaseError)) Logger.warn(err.stack);
  else Logger.warn(err.message);

  if (err instanceof ValidateError) {
    Logger.warn(`Caught Validation Error for ${req.path}: ${util.inspect(err.fields)}`);
    return res.status(422).json({
      message: 'Validation Failed',
      details: err?.fields,
    });
  }

  const status = err.statusCode || 400;
  if (err.message) {
    res.status(status).json({ error: err.message, ...err.data });
  } else res.sendStatus(status);
});
