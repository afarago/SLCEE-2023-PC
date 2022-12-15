import 'reflect-metadata';

import { Mutex } from 'async-mutex';
import dotenv from 'dotenv';
import * as mongoDB from 'mongodb';
import { EventEmitter } from 'node:events';
import { Service } from 'typedi';

import Logger from '../config/logger';

@Service()
export default class DbService {
  private db: mongoDB.Db;
  private inited: boolean;
  client: mongoDB.MongoClient;
  collections: {
    matches: mongoDB.Collection<mongoDB.Document>;
    moves: mongoDB.Collection<mongoDB.Document>;
    players: mongoDB.Collection<mongoDB.Document>;
  };
  onCollectionChanged = new EventEmitter();

  private initMutex = new Mutex();
  async connectToDatabase() {
    await this.initMutex.runExclusive(async () => {
      if (this.inited) return;

      dotenv.config();
      if (!process.env.MONGODB_CONN_STRING || !process.env.MONGODB_DBNAME)
        throw new Error('No DBConnection initialized');
      this.client = new mongoDB.MongoClient(process.env.MONGODB_CONN_STRING);

      await this.client.connect();
      this.db = this.client.db(process.env.MONGODB_DBNAME);
      Logger.info(`Using database ${this.db.databaseName}`);

      this.collections = {
        matches: this.db.collection('matches'),
        moves: this.db.collection('moves'),
        players: this.db.collection('players'),
      };

      this.initChangeMonitoring();

      this.inited = true;
    });
  }
  async ensureConnected(): Promise<void> {
    if (!this.inited) await this.connectToDatabase();
  }
  get databaseName(): string {
    return process.env.MONGODB_DBNAME ?? '';
  }

  private initChangeMonitoring(): void {
    for (const [colname, collection] of Object.entries(this.collections)) {
      const changeStream = collection.watch();
      changeStream.on('change', async (item: any) => {
        if (item.hasOwnProperty('documentKey')) {
          this.onCollectionChanged.emit(
            'change',
            item.ns.coll,
            item.documentKey?._id?.toString(),
            item.operationType,
            item
          );
        }
      });
    }
  }
}
