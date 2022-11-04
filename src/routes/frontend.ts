import e, * as express from "express";
import Registry from "../game/registry";
import * as model from "../game/model/model";
import { ObjectId } from "mongodb";

export const register = (app: express.Application) => {
  app.get("/", (req: any, res) => {
    res.redirect("/matches");
  });

  app.get("/matches", async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        // const user = req.userContext ? req.userContext.userinfo : null;
        const matches = await Registry.Instance.getMatchesPromise();
        const players: Map<string, model.Player> = (
          await Registry.Instance.getPlayersPromise()
        ).reduce(
          (prev, current) => prev.set(current._id.toString(), current),
          new Map<string, model.Player>()
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
        const players: Map<string, model.Player> = (
          await Registry.Instance.getPlayersPromise()
        ).reduce(
          (prev, current) => prev.set(current._id.toString(), current),
          new Map<string, model.Player>()
        );
        const getPlayer = function (id: model.PlayerId | string): model.Player {
          return players.get(id.toString());
        };
        //TODO: get only affected player objects
        const match = await Registry.Instance.getMatchByIdPromise(matchId);
        const moves = await Registry.Instance.getAllMovesByMatchIdPromise(matchId);
        //match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match._id);
        match.move = moves.at(-1);

        //-- compile matchinfo object
        let matchinfo = {
          banks: match.state?.banks,
          drawPileSize: match.state?.drawPile?.length,
          discardPileSize: match.state?.discardPile?.length,
          playArea: match.state?.playArea,
          pendingEffect: match.state?.pendingEffect,
        };
        const matchendEvent =
          match.move?.lastEvent?.eventType === model.OMatchEventType.MatchEnded
            ? match.move?.lastEvent
            : null;
        if (matchendEvent) {
          matchinfo = {
            ...matchinfo,
            ...{
              winner: matchendEvent.matchEndedWinner,
              scores: matchendEvent.matchEndedScores,
            },
          };
        }

        const fnSanitizeEvent = (event: model.MatchEvent) => {
          let retval = model.apifyEvent(event);
          delete retval.eventType;
          return retval;
        };
        if (!match) return res.send("error");
        const viewoptions = { debug_showstacks: true };

        res.render("match", { match, matchinfo, moves, getPlayer, viewoptions, fnSanitizeEvent }); // TODO: error handling
      })
      .catch(next); // Errors will be passed to Express.
  });
};
