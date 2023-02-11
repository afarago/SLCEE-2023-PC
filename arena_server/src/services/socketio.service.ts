import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { Service } from 'typedi';

import Logger from '../config/logger';
import { authenticateOptionally } from '../config/passport';

// -- milliseconds of a session.io session length before terminating and expecting reconnect from client side
const SOCKETIO_SESSION_LENGTH_MS = Number(process.env.SOCKETIO_SESSION_LENGTH_MS) || 5 * 60 * 1000;

@Service()
export default class SocketIOService {
  public connectCounter: number = 0;
  private io: IOServer;

  public register(app: express.Application): [HttpServer, IOServer] {
    const httpServer = createServer(app);
    this.io = new IOServer(httpServer);

    // -- add passport auth optionally - yet socket.request contains request
    // this.io.use((socket, next) => authenticateOptionally(socket.request, null, next));

    // NOTE: later could rework onto using selective namespaces instead of rooms
    // NOTE: later check if user registers to the correct room
    this.io
      // .of(/^\/.+$/)
      .on('connection', (socket: any) => {
        this.connectCounter++;

        //-- auto close connections after 60 mins
        setTimeout(() => {
          socket.disconnect(true); //-- kick client
        }, SOCKETIO_SESSION_LENGTH_MS);

        // -- request from client side to join a room
        socket.on('room', (room: string) => {
          // console.log('[room] joining', room);

          // -- leaving any other rooms
          Array.from(socket.rooms).forEach((room) => {
            if (room !== socket.id) socket.leave(room);
          });

          // -- joining target room
          socket.join(room);
        });

        // //console.log('a user connected');
        // try {
        //   const authorization = socket.handshake.headers.authorization;
        //   const parts = authorization.split(' ');
        //   const scheme = parts[0];
        //   const credentials = new Buffer(parts[1], 'base64').toString().split(':');
        //   //if (!/Basic/i.test(scheme)) { return this.fail(this._challenge()); }
        //   //if (credentials.length < 2) { return this.fail(400); }
        //   const userid = credentials[0];
        //   const password = credentials[1];

        //   console.log(`Hello user: ${userid}`);
        //   socket.emit('hello', userid);
        //   socket.broadcast.emit('hello', 'other:'+userid);
        // } catch {}
        // //socket.broadcast.emit('hi');

        socket.on('disconnect', () => {
          this.connectCounter--;
        });
      });

    return [httpServer, this.io];
  }

  public emitMessage(topic: string, room: string, msg: any, volatile: boolean = false) {
    // Logger.info(`${topic} ${room} connectCounter:${connectCounter}`);

    try {
      let iotarget: any = !room ? this.io : this.io.in(room); // -- .in() is room .of() is namespace
      if (volatile) iotarget = iotarget.volatile;

      // Note: Map and Set are not serializable and must be manually serialized:
      iotarget.emit(topic, JSON.stringify(msg));
    } catch (e) {
      Logger.error(`socket.io error while emit ${e}`);
    }
  }
}
