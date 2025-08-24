import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import winston from 'winston';

let logger: winston.Logger | null = null;

export function getLogsDir() {
  const dir = path.join(app.getPath('appData'), 'FS25ModLoader', 'logs');
  fs.ensureDirSync(dir);
  return dir;
}

export function getLogger() {
  if (logger) return logger;
  const logDir = getLogsDir();
  const logfile = path.join(logDir, 'app.log');
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`)
    ),
    transports: [
      new winston.transports.File({ filename: logfile, maxsize: 5 * 1024 * 1024, maxFiles: 3 }),
      new winston.transports.Console({})
    ]
  });
  return logger;
}

export function openLogsFolder() {
  const { shell } = require('electron');
  return shell.openPath(getLogsDir());
}


