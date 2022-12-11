import { CardEffectType } from '../models/game/cardeffect';
import { integer } from '../models/game/model';
import { ObjectIdString } from '../services/dba.service';

export interface MatchHeaderPartialDTO {
  id: ObjectIdString;
  sequence: string;
  lastmoveat: Date;
  finished: boolean;
  table: {
    effect?: CardEffectType;
    playarea: integer;
    drawpile: integer;
    discardpile: integer;
  };
  playerdata: {
    active?: boolean | null;
    winner?: boolean | null;
    banksize: integer;
    bankvalue: integer;
  }[];
}

export interface MatchHeaderFullDTO extends MatchHeaderPartialDTO {
  startedat: Date;
  tags?: string[];
  playernames: string[];
}

export type MatchHeaderDTO = MatchHeaderFullDTO | MatchHeaderPartialDTO;
