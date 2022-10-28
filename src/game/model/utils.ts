import * as model from "./model";

export function apifyEvent(event: model.MatchEvent) {
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
    match.move?.lastEvent.eventType === model.OMatchEventType.MatchEnded
      ? match.move?.lastEvent
      : null;
  //TODO: maybe fill this up upon ending the match to the match db itself
  if (matchendEvent) {
    retval.winner = matchendEvent.matchEndedWinner;
    retval.scores = matchendEvent.matchEndedScores;
    retval.endedAt = match.move?.at;
  }
  if (!parameters?.debug?.keep?.move) delete retval.move;

  return retval;
}

export function apifyEvents(events: model.MatchEvent[], parameters?: any) {
  let retval = [];

  for (let e_ of events) retval.push(apifyEvent(e_));

  return retval;
}
