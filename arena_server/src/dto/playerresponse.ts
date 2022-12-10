import { ObjectIdString } from '../services/dba.service';

export interface PlayerDTO {
  _id: ObjectIdString;
  name: string;
  email?: string | null;
}
