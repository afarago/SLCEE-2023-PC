import * as express from "express";
import * as api from "./api";
import Registry from "../game/registry";
import Coordinator from "../game/coordinator";
import * as model from "../game/model";
import { apifyEvent } from "../utils";

export const register = (app: express.Application) => {
  // define a route handler for the default home page
  app.get("/", (req: any, res) => {
    res.redirect("/matches");
  });

  app.get("/matches", (req: any, res) => {
    const user = req.userContext ? req.userContext.userinfo : null;
    const matches = Registry.Instance.getMatches();
    const players = Registry.Instance.getPlayers();
    res.render("matches", { matches, players });
  });

  // define a secure route handler for the guitars page
  app.get("/matches/:matchId", (req: any, res) => {
    const matchId = req.params.matchId;
    const match = Registry.Instance.getMatchById(matchId);
    const players = Registry.Instance.getPlayers();
    const fnSanitizeEvent = (event: model.MatchEventBase) => {
      let retval = apifyEvent(event);
      delete retval.eventType;
      return retval;
    };
    if (!match) return res.send("error");
    res.render("match", { match, players, fnSanitizeEvent }); // TODO: error handling
  });

  api.register(app);
};
