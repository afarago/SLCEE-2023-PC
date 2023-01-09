import express from 'express';
import { ValidateError } from 'tsoa';
import * as util from 'util';

import { authedLimiter } from '../config/limiter';
import Logger from '../config/logger';
import { authenticate, authenticateOptionally, ensureAdmin } from '../config/passport';
import FrontendController from '../controllers/frontend.controller';
import HelloController from '../controllers/hello.controller';
import MatchesController from '../controllers/match.controller';
import PlayersController from '../controllers/players.controller';
import SessionInfoController from '../controllers/sessioninfo.controller';
import WhoAmIController from '../controllers/whoami.controller';
import { APIError, BaseError } from '../dto/utils';
import { fnSetMapSerializer } from '../utils/json.utils';

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
app.route('/api/whoami').get(authenticate, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new WhoAmIController();
      const response = await controller.getAuthenticatedUser(req);
      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});

// -- SessionInfo endpoint handler
app.route('/api/sessioninfo').get(authenticateOptionally, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new SessionInfoController();
      const response = await controller.getSessionInfo(req);
      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});

// -- Matches endpoint
app
  .route('/api/matches')
  // -- Retrieve list of Match handler: for admins show all, for players show only matches with involvement
  .get(authenticate, authedLimiter, async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.getMatches(
          req,
          req.query.at as any,
          req.query.active as any,
          req.query.tags as any,
          req.query.wait as any,
          req.query.condensed as any,
          req.query.limit as any,
          req.query.offset as any,
          req.query.sortasc as any,
          req.query.id as any
        );
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  })

  // -- Create new Match handler: for both users (when this user is in the list of users) and admins
  .post(authenticate, authedLimiter, async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.createMatch(req, req.body);
        res.set('X-Result-Id', response.id);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- Get calendar statistics for a month for frontend listing
app.route('/api/matches/busydays').get(authenticate, authedLimiter, async (req, res, next) => {
  Promise.resolve()
    .then(async () => {
      const controller = new MatchesController();
      const response = await controller.getMatchStatisticsBusyDays(req, req.query.at as any);
      return res.send(response);
    })
    .catch(next); // Errors will be passed to Express.
});
//  /matches/statistics?from=12/1/2022&to=12/31/2022&tags=alma,korte&status=finished|active
//    implicit filter by player or admin
// Csaba: tournament stats: tag+(?date)=>[winnerid,scores]
// calendar picker: filterset(tags,date+-range,(user)) => day/count

// -- matches/watchdog endpoint
app
  .route('/api/matches/watchdog')
  // -- Delete a Match forcefully: for admin only
  .post(authenticate, ensureAdmin, async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.watchDogMatches(req, req.query.tags as any);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- Matches/{id} endpoint
app
  .route('/api/matches/:id')

  // -- Retrieve basic info about Match: for admins and participating players only
  .get(authenticate, authedLimiter, async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.getMatch(
          req,
          req.params.id,
          req.query.waitactive as any,
          req.query.showevents as any,
          req.query.showdebug as any,
          req.query.condensed as any
        );
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  })

  // -- Execute action for Match: for participating players only
  .post(authenticate, authedLimiter, async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const controller = new MatchesController();
        const response = await controller.executeActionForMatch(req, req.params.id, req.body, req.query.wait as any);
        return res.send(response);
      })
      .catch(next); // Errors will be passed to Express.
  });

// -- matches/{id}/terminate endpoint
app
  .route('/api/matches/:id/terminate')
  // -- Delete a Match forcefully: for admin only
  .delete(authenticate, ensureAdmin, async (req, res, next) => {
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
  .get(authenticate, ensureAdmin, async (req, res, next) => {
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
  .get(authenticate, authedLimiter, async (req, res, next) => {
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

  // -- API error returns either message or data payload
  if (err instanceof APIError && err.data) {
    return res.status(status).json(err.data);
  }

  // -- other types can return message
  if (err.message) {
    res.status(status).json({ error: err.message });
  } else res.sendStatus(status);
});
