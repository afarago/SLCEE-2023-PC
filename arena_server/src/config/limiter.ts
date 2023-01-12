import slowDown from 'express-slow-down';
// import { IUser } from './passport';

const ddosLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 1000,
  delayMs: 100,
  maxDelayMs: 10 * 1000,
  keyGenerator(req: any /*, res*/) {
    return req.ip;
  },
});

const authedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 100,
  delayMs: 100,
  maxDelayMs: 10 * 1000,
  headers: true,
  keyGenerator(req: any /*, res*/) {
    return req.ip + req.user?.username;
  },
  skip(req: any /*, res*/) {
    return req.user?.isAdmin;
  },
});

export { ddosLimiter, authedLimiter };
