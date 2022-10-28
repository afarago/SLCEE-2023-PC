import e, * as express from "express";
import Registry from "../game/registry";
import * as model from "../game/model/model";

export const register = (app: express.Application) => {
  app.get("/", (req: any, res) => {
    res.redirect("/matches");
  });

  app.get("/matches", async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const user = req.userContext ? req.userContext.userinfo : null;
        const matches = await Registry.Instance.getMatchesPromise();
        res.render("matches", { matches });
      })
      .catch(next); // Errors will be passed to Express.
  });

  // define a secure route handler for the guitars page
  app.get("/matches/:matchId", async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const matchId = req.params.matchId;
        const match = await Registry.Instance.getMatchByIdPromise(matchId);
        const moves = await Registry.Instance.getAllMovesByMatchIdPromise(matchId);
        const fnSanitizeEvent = (event: model.MatchEvent) => {
          let retval = model.apifyEvent(event);
          delete retval.eventType;
          return retval;
        };
        if (!match) return res.send("error");
        res.render("match", { match, moves, fnSanitizeEvent }); // TODO: error handling
      })
      .catch(next); // Errors will be passed to Express.
  });
};
