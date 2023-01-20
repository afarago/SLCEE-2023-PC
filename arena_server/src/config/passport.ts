import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import passportAnonymous from 'passport-anonymous';
import passportHttp from 'passport-http';
import { Container } from 'typedi';

import DBAService from '../services/dba.service';

const dbaService = Container.get(DBAService);

const ADMIN_USER = 'admin';
const REALM = 'SLCEE-2023-PC';

export interface IUser {
  username: string;
  isAdmin: boolean;
  email?: string;
  name?: string;
}

passport.use(new passportAnonymous.Strategy());

async function httpSecretFunction(
  username: string,
  checkPassword: boolean,
  password: string | null,
  done: (error: any, user?: any, password?: any) => void
): Promise<void> {
  try {
    if (username === ADMIN_USER) {
      if (
        !process.env.ADMIN_PASSWORD ||
        (checkPassword && (!password || !comparePasswords(password, process.env.ADMIN_PASSWORD)))
      )
        throw new Error();

      const user = { username, isAdmin: true } as IUser;
      return done(null, user, process.env.ADMIN_PASSWORD);
    } else {
      const player = await dbaService.getPlayerByIdPromise(username);
      if (
        !player ||
        (checkPassword && (!password || !player.passwordhash || !comparePasswords(password, player.passwordhash)))
      )
        throw new Error();

      const user = { username, isAdmin: false, email: player.email, name: player.name } as IUser;
      return done(null, user, player.passwordhash);
    }
  } catch (e) {
    return done(null, false);
  }
}

passport.use(
  new passportHttp.BasicStrategy({ realm: REALM }, async (username, password, done) => {
    const done1 = (error: any, user?: any, password?: any) => {
      done(error, user);
    };
    await httpSecretFunction(username, true, password, done1);
  })
);

passport.use(
  new passportHttp.DigestStrategy({ realm: REALM, qop: 'auth' }, async (username, done) => {
    const done1 = (error: any, user?: any, password?: any) => {
      done(error, user, password);
    };
    await httpSecretFunction(username, false, null, done1);
  })
);

export const authenticate = passport.authenticate(['digest', 'basic'], { session: false });
export const authenticateWithRedirect = passport.authenticate(['digest', 'basic'], {
  session: false,
  failureRedirect: '/login',
});
export const authenticateOptionally = passport.authenticate(['digest', 'basic', 'anonymous'], {
  session: false,
});

// export const isAdminAuthenticated = (req: Request, res: Response, next: NextFunction) => {
//   const fn = (req: Request, res: Response, next: NextFunction) => {
//     if (!(req.user as IUser).isAdmin) res.sendStatus(401);
//   };
//   return isAuthenticated(req, res, fn);
// };

export const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;
  if (!user?.isAdmin) return res.sendStatus(401);

  next();
};

const comparePasswords = (candidate?: string, fact?: string): boolean => {
  return candidate === fact;
};

/*
function newFunction(): string | undefined {
  return 'slhpc23';
}

const timingSafeEqual = require('crypto').timingSafeEqual

// Credits for the actual algorithm go to github/@Bruce17
// Thanks to github/@hraban for making me implement this
function safeCompare(userInput, secret) {
    const userInputLength = Buffer.byteLength(userInput)
    const secretLength = Buffer.byteLength(secret)

    const userInputBuffer = Buffer.alloc(userInputLength, 0, 'utf8')
    userInputBuffer.write(userInput)
    const secretBuffer = Buffer.alloc(userInputLength, 0, 'utf8')
    secretBuffer.write(secret)

    return !!(timingSafeEqual(userInputBuffer, secretBuffer) & userInputLength === secretLength)
}
*/
