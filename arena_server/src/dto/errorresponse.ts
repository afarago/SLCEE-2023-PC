import { MatchEventDTO } from './matchresponse';

export type ErrorResponse = {
  error: string;
};

export type ActionErrorResponse = {
  error: string;
  events?: MatchEventDTO[];
};
