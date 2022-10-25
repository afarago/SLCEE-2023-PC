import * as model from "./game/model";

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
  retval.movesCount = match.moves.length;
  retval.banks = match.state.banks;
  retval.drawPileSize = match.state.drawPile.length;
  retval.discardPileSize = match.state.discardPile.length;
  retval.playArea = match.state.playArea;
  retval.pendingEffect = match.pendingEffect;
  retval.startedAt = match.startedAt;
  const matchendEvent =
    match.lastMove.lastEvent instanceof model.MatchEnded
      ? (match.lastMove.lastEvent as model.MatchEnded)
      : null;
  retval.isFinished = !!matchendEvent;
  if (matchendEvent) {
    retval.winner = matchendEvent.winner;
    retval.scores = matchendEvent.scores;
    retval.endedAt = match.lastMove?.at;
  }
  if (!parameters?.moves) delete retval.moves;

  return retval;
}
