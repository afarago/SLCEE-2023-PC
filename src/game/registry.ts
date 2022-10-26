import "core-js/es/array/at";
import * as model from "./model";

export default class Registry {
  private static _instance: Registry;
  public static get Instance(): Registry {
    return this._instance || (this._instance = new this());
  }

  players: model.Player[] = [];
  matches: model.Match[] = [];

  public getMatches(): model.Match[] {
    return this.matches;
  }
  public addMatch(match: model.Match) {
    this.matches.push(match);
  }
  public getMatchById(id: model.MatchId): model.Match {
    return this.matches.find((e) => e.id == id);
  }
  
  public getPlayers(): model.Player[] {
    return this.players;
  }
  public getPlayerById(id: model.PlayerId): model.Player {
    return this.players.at(id);
  }
}
