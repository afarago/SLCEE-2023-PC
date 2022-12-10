import winston from 'winston';
import dotenv from 'dotenv';
dotenv.config();

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

let format = winston.format.combine(
  winston.format.printf((info) => `${info.matchId ? '[' + info.matchId?.toString() + '] ' : ''}${info.message}`)
);

if (!process.env.LOGGING_NO_COLORS) {
  winston.addColors(colors);
  format = winston.format.combine(format, winston.format.colorize({ all: true }));
}

const transports = [
  new winston.transports.Console(),
  // GCLOUD: The runtime includes a full filesystem.
  // The filesystem is read-only except for the location /tmp, which is a virtual disk storing data in your App Engine instance's RAM.
  // process.env.GOOGLE_CLOUD_PROJECT_ID?[]:
  // new DailyRotateFile({
  //   filename: 'logs/error.log',
  //   level: 'error',
  // }),
  // new DailyRotateFile({ filename: 'logs/all.log' }),
];

const Logger = winston.createLogger({
  // const Logger = new winston.Logger({
  level: 'debug',
  levels, // winston.config.cli.levels,
  format,
  transports,
  exitOnError: false,
});

export default Logger;
