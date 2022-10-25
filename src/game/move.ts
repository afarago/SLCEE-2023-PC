import * as model from "./model";
import * as matchevent from "./matchevent";
import { MatchState } from "./matchstate";

export class Move {
  at: Date = new Date();
  context: model.ContextId;
  events: Array<matchevent.MatchEventBase> = [];
  constructor(context: model.ContextId) {
    this.context = context;
  }
  get state(): MatchState {
    return this.lastEvent?.state;
  }
  get lastEvent(): matchevent.MatchEventBase {
    return this.events.at(-1);
  }
  get currentPlayerIndex(): model.PlayerId {
    return this.state.currentPlayerIndex;
  }
  getEvents(): Array<matchevent.MatchEventBase> {
    return this.events;
  }
  addEvent(event: matchevent.MatchEventBase): void {
    this.events.push(event);
  }
}
