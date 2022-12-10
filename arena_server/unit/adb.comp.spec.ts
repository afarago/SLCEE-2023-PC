import { jest, test, xtest } from '@jest/globals';
import { Container } from 'typedi';

import PlayersController from '../src/controllers/players.controller';

// jest.mock('../src/services/dba.service');
// import DBAService from '../src/services/dba.service';

// class MockDBAService {
//   public async getMatchesPromise(options: {}): Promise<Match[]> {
//     return [];
//   }
//   public async getPlayersPromise(isHeadOnly?: boolean): Promise<Player[]> {
//     return [];
//   }
//   public async getPlayerByIdPromise(id: ObjectIdString, isHeadOnly?: boolean): Promise<Player | null> {
//     return null;
//   }
// }
// Container.set(DBAService, new MockDBAService());

// jest.mock('../src/services/dba.service', () => {
//   // const originalModule = jest.mock('../src/services/dba.service');
//   return {
//     getPlayersPromise: jest.fn().mockImplementation(async (): Promise<Player[]> => {
//       return [
//         { _id: new ObjectId('123456789000'), name: 'user0' },
//         { _id: new ObjectId('123456789001'), name: 'user1' },
//       ];
//     }),
//   };
// });

xtest('test mocking', async () => {
  const user = { username: 'admin', isAdmin: true };
  const controller = new PlayersController();

  //dbaService.getPlayersPromise.mockResolvedValue()
  const req = { user };
  const response = await controller.getPlayers(req);
  console.log(response);

  //   const response1 = await controller.getPlayer("123456789000");
  //   console.log(response1);
  //   //   axios.get.mockResolvedValue(resp);
});
