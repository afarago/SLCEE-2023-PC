import 'reflect-metadata';

import dotenv from 'dotenv';
import express from 'express';
import passport from 'passport';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { Container } from 'typedi';
import * as util from 'util';

import * as googleWebApp from './config/google_web_app';
import { ddosLimiter } from './config/limiter';
import Logger from './config/logger';
import api from './routes/api';
import frontend from './routes/frontend';
import SocketIOService from './services/socketio.service';

// initialize configuration
dotenv.config();
util.inspect.defaultOptions.depth = Infinity;

// port is now available to the Node.js runtime
// as if it were an environment variable
const port = process.env.PORT ?? 8080;

const app = express();

// -- use passport for authentication
app.use(passport.initialize());

//-- use ddos speed limiter
app.use(ddosLimiter);

// Configure Express to parse incoming JSON data
// strict:Enables or disables only accepting arrays and objects; when disabled will accept anything JSON.parse accepts.
// reviver: The reviver option is passed directly to JSON.parse as the second argument. You can find more information on this argument in the MDN documentation about JSON.parse.
// app.use(express.json());

/// GCLOUD: App Engine terminates HTTPS connections at the load balancer and forwards requests to your application.
/// Some applications need to determine the original request IP and protocol.
/// The user's IP address is available in the standard X-Forwarded-For header.
/// Applications that require this information should configure their web framework to trust the proxy.
app.set('trust proxy', true);

// Configure Express to serve static files in the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Start SocketIO for frontend
const socketio = Container.get(SocketIOService);
const [httpServer, io] = socketio.register(app);

// app.use((req, res, next) => {
//   res.locals.user = req.user;
//   next();
// });

// === Google specific handling ==================
googleWebApp.register(app);

// === API ==================
// Configure Express to serve swagger OpenAPI
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: '/swagger.json',
    },
  })
);

// Configure routes
// app.use('/api/v1', api);
// app.use('/api', api);
app.use('/', api); // -- digest authentication in passport cannot handle mapped path

// === FRONTEND ==================
app.use('/', frontend);

// start the express server
httpServer.listen(port, () => {
  // REMARK: The app.listen() method returns an http.Server object and (for HTTP) is a convenience method for this
  Logger.info(`server started at http://localhost:${port}`.valueOf());
});

if (process.env.DEBUG) {
  process.on('unhandledRejection', (reason: Error | any) => {
    /* tslint:disable-next-line no-console */
    console.error(`Unhandled Rejection: ${reason.message || reason}`);
    throw new Error(reason.message || reason);
  });
} else {
  // NOOP in release mode
}

// process.on('uncaughtException', (error: Error) => {
//   console.log(`Uncaught Exception: ${error.message}`);

//   errorHandler.handleError(error);
// });
