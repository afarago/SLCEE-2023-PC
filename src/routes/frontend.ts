import e, * as express from "express";
import Registry from "../game/registry";
import * as model from "../game/model";
import { apifyEvent } from "../utils";

export const register = (app: express.Application) => {
  app.get("/", (req: any, res) => {
    res.redirect("/matches");
  });

  app.get("/matches", async (req: any, res) => {
    const user = req.userContext ? req.userContext.userinfo : null;
    const matches = await Registry.Instance.getMatchesPromise();
    res.render("matches", { matches });
  });

  // define a secure route handler for the guitars page
  app.get("/matches/:matchId", async (req: any, res) => {
    const matchId = req.params.matchId;
    const match = await Registry.Instance.getMatchByIdPromise(matchId);
    const fnSanitizeEvent = (event: model.MatchEventBase) => {
      let retval = apifyEvent(event);
      delete retval.eventType;
      return retval;
    };
    if (!match) return res.send("error");
    res.render("match", { match, fnSanitizeEvent }); // TODO: error handling
  });
};
