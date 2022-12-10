import 'reflect-metadata';

import dotenv from 'dotenv';
import * as mongoDB from 'mongodb';
import { Service } from 'typedi';

import Logger from '../config/logger';

type MonitorDBASyncCallback = (documentKey: string, operationType: string, item: any) => Promise<void>;
@Service()
export default class DbService {
  public playersCollection?: mongoDB.Collection;
  public matchesCollection?: mongoDB.Collection;
  public movesCollection?: mongoDB.Collection;
  public client: mongoDB.MongoClient;
  private _db: mongoDB.Db;
  private _inited: boolean;

  async connectToDatabase() {
    dotenv.config();
    this.client = new mongoDB.MongoClient(process.env.MONGODB_CONN_STRING);

    await this.client.connect();
    this._db = this.client.db(process.env.MONGODB_DBNAME);
    Logger.info(`Using database ${this._db.databaseName}`);

    this.playersCollection = this._db.collection('players');
    this.matchesCollection = this._db.collection('matches');
    this.movesCollection = this._db.collection('moves');

    this._inited = true;
  }
  async ensureConnected(): Promise<void> {
    if (!this._inited) await this.connectToDatabase();
  }
  public get databaseName(): string {
    return process.env.MONGODB_DBNAME;
  }

  private monitorChangeStream(collection: mongoDB.Collection, cb: MonitorDBASyncCallback): void {
    // await this.ensureConnected();
    const changeStream = collection.watch();
    changeStream.on('change', async (item: any) => {
      if (item.hasOwnProperty('documentKey')) {
        if (cb) {
          await cb(item.documentKey?._id?.toString(), item.operationType, item);
        }
      }
    });
  }

  async monitorMatchesPromise(cb: MonitorDBASyncCallback): Promise<void> {
    await this.ensureConnected();
    this.monitorChangeStream(this.matchesCollection, cb);
  }
  async monitorMovesPromise(cb: MonitorDBASyncCallback): Promise<void> {
    await this.ensureConnected();
    this.monitorChangeStream(this.movesCollection, cb);
  }
  async monitorPlayersPromise(cb: MonitorDBASyncCallback): Promise<void> {
    await this.ensureConnected();
    this.monitorChangeStream(this.playersCollection, cb);
  }
}
