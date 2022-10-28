import e, * as express from "express";
import Registry from "../game/registry";
import Coordinator from "../game/coordinator";
import * as model from "../game/model/model";
import * as utils from "../utils";

export const register = (app: express.Application) => {
  //-- add set replacer
  app.set("json replacer", utils.fnSetMapSerializer);

  app.post(`/api/matches`, async (req: any, res, next) => {
    Promise.resolve()
      .then(async () => {
        const data = req.body;

        if (!data.players) throw new Error("Missing players from input parameters.");
        if (!(data.players instanceof Array))
          throw new Error("Missing players from input parameters.");
        let players = new Array<model.PlayerId>(...data.players);
        let drawPile = data.drawPile;
        const match = await Coordinator.Instance.actionStartMatch(players, drawPile);
        if (!match) throw Error("Could not create match.");

        return res.json({ id: match.id });
      })
      .catch(next); // Errors will be passed to Express.
  });

  app.get(
    `/api/matches`,
    // oidc.ensureAuthenticated(),
    async (req: any, res, next) => {
      Promise.resolve()
        .then(async () => {
          const matches = Object.values(await Registry.Instance.getMatchesPromise());
          const params = req.body;

          return res.json(matches.map((match) => model.apifyMatch(match, params)));
        })
        .catch(next); // Errors will be passed to Express.
    }
  );

  app.get(
    `/api/matches/:id`, // TODO: add a from index param as well for easy polling
    // oidc.ensureAuthenticated(),
    async (req: any, res, next) => {
      Promise.resolve()
        .then(async () => {
          const id = req.params.id;
          const data = req.body;

          const match = await Registry.Instance.getMatchByIdPromise(id);
          if (!match) throw Error("Match does not exist.");
          match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match.id);
          if (!match.move) throw Error("Consistency error - no move exist for match.");

          //TODO: check debug settings
          return res.json(model.apifyMatch(match, data));
        })
        .catch(next); // Errors will be passed to Express.
    }
  );

  //-- execute user action on an existing match
  app.post(
    `/api/matches/:id`, // TODO: add a from index param as well for easy polling
    // oidc.ensureAuthenticated(),
    async (req: any, res, next) => {
      Promise.resolve()
        .then(async () => {
          const id = req.params.id;
          const data = req.body;

          const match = await Registry.Instance.getMatchByIdPromise(id);
          if (!match) throw Error("Match does not exist.");
          match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match.id);
          if (!match.move) throw Error("Consistency error - no move exist for match.");

          const events = await Coordinator.Instance.executeActionPromise(match, data);
          //if (!events) return res.send(404);
          if (!events) return next("Error processing request.");

          return res.json(model.apifyEvents(events, data));
        })
        .catch(next); // Errors will be passed to Express.
    }
  );

  //-- retrieve players
  app.get("/api/players", async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const result = await Registry.Instance.getPlayersPromise();
        if (!result) throw new Error("No records found");
        res.json(result);
      })
      .catch(next); // Errors will be passed to Express.
  });

  //-- retrieve player by id
  app.get("/api/players/:id", async (req, res, next) => {
    Promise.resolve()
      .then(async () => {
        const id = req.params.id;
        const result = await Registry.Instance.getPlayerByIdPromise(id);
        if (!result) throw new Error("Record not found");
        res.json(result);
      })
      .catch(next); // Errors will be passed to Express.
  });

  //--You define error-handling middleware last, after other app.use() and routes calls;
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ Error: err.message });
  });
};
