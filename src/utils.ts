import * as model from "./game/model";
import { DynamoDB } from "aws-sdk";

export function fnSetMapSerializer(_key: any, value: any) {
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return Object.fromEntries(value);
  return value;
}

export function apifyEvents(events: model.MatchEventBase[], parameters?: any) {
  let retval = [];

  for (let e_ of events) retval.push(apifyEvent(e_));

  return retval;
}

export function apifyEvent(event: model.MatchEventBase) {
  let e = { ...event }; // create a shallow copy, to remove unneeded properties
  delete e.state;

  return e;
}

export function apifyMatch(match: model.Match, parameters?: any) {
  let retval: any = { ...match }; // create a shallow copy, to remove unneeded properties

  retval.currentPlayer = match.currentPlayer ?? null; //-- will yield undefined if out or range (e.g. ended)
  retval.movesCount = match.move?.sequenceId;
  retval.banks = match.state?.banks;
  retval.drawPileSize = match.state?.drawPile?.length;
  retval.discardPileSize = match.state?.discardPile?.length;
  retval.playArea = match.state?.playArea;
  const matchendEvent =
    match.move?.lastEvent instanceof model.MatchEnded
      ? (match.move?.lastEvent as model.MatchEnded)
      : null;
  //TODO: maybe fill this up upon ending the match to the match db itself
  if (matchendEvent) {
    retval.winner = matchendEvent.winner;
    retval.scores = matchendEvent.scores;
    retval.endedAt = match.move?.at;
  }
  if (!parameters?.debug?.keep?.move) delete retval.move;

  return retval;
}

// export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ I: value.getTime() } as DynamoDB.AttributeValue);

// export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ I: value.getTime() } as DynamoDB.AttributeValue);
export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
  ({ S: value.toISOString() } as DynamoDB.AttributeValue);

export const dateUnmarshall = ({ S }: DynamoDB.AttributeValue): Date | undefined =>
  S ? new Date(S) : undefined;
//   export const ddbDateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ N: value.getTime().toString() } as DynamoDB.AttributeValue);
// export const ddbDateUnmarshall = ({ N }: DynamoDB.AttributeValue): Date | undefined =>
//   N ? new Date(N) : undefined;
