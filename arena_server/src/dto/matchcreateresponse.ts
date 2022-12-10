import { ObjectIdString } from '../services/dba.service';

/** Match creation result
 * @param id created match id
 * @param randomSeed randomization seed, either input from the user or generated - can be used to recreate the match
 */
export type MatchCreateResponse = {
  id: ObjectIdString;
  randomSeed?: string;
};
