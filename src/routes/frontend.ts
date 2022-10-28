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
        const players: Map<model.PlayerId, model.Player> = (
          await Registry.Instance.getPlayersPromise()
        ).reduce(
          (prev, current) => prev.set(current.id, current),
          new Map<model.PlayerId, model.Player>()
        );
        res.render("matches", { matches, players });
      })
      .catch(next); // Errors will be passed to Express.
  });

  // define a secure route handler for the guitars page
  app.get("/matches/:matchId", async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const matchId = req.params.matchId;
        const players: Map<model.PlayerId, model.Player> = (
          await Registry.Instance.getPlayersPromise()
        ).reduce(
          (prev, current) => prev.set(current.id, current),
          new Map<model.PlayerId, model.Player>()
        ); //TODO: get only affected player objects
        const match = await Registry.Instance.getMatchByIdPromise(matchId);
        const moves = await Registry.Instance.getAllMovesByMatchIdPromise(matchId);
        const fnSanitizeEvent = (event: model.MatchEvent) => {
          let retval = model.apifyEvent(event);
          delete retval.eventType;
          return retval;
        };
        if (!match) return res.send("error");
        res.render("match", { match, moves, players, fnSanitizeEvent }); // TODO: error handling
      })
      .catch(next); // Errors will be passed to Express.
  });
};
