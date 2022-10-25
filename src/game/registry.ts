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
  public getPlayers(): model.Player[] {
    return this.players;
  }

  public addMatch(match: model.Match) {
    this.matches.push(match);
  }

  public getMatchById(id: model.MatchId): model.Match {
    return this.matches.find((e) => e.id == id);
  }
}
