import e, * as express from "express";
import Registry from "../game/registry";
import Coordinator from "../game/coordinator";
import * as model from "../game/model";
import * as utils from "../utils";

export const register = (app: express.Application) => {
  //     const oidc = app.locals.oidc;
  //   const port = parseInt(process.env.PGPORT || "5432", 10);
  //   const config = {
  //     database: process.env.PGDATABASE || "postgres",
  //     host: process.env.PGHOST || "localhost",
  //     port,
  //     user: process.env.PGUSER || "postgres",
  //   };

  // const pgp = pgPromise();
  // const db = pgp(config);

  // //-- dev automation testing
  // Coordinator.__cardsPileForTesting = [
  //   // // SET
  //   // { suit: "Kraken", value: 2 },
  //   // { suit: "Kraken", value: 3 },
  //   // { suit: "Hook", value: 3 },
  //   // // SET
  //   // { suit: "Oracle", value: 2 },
  //   // { suit: "Mermaid", value: 4 },
  //   // { suit: "Hook", value: 3 },
  //   // // SET
  //   // { suit: "Mermaid", value: 4 },
  //   // { suit: "Map", value: 5 },
  //   // { suit: "Hook", value: 3 },
  //   // { suit: "Oracle", value: 2 },
  //   // { suit: "Hook", value: 4 },
  //   // // SET
  //   // { suit: "Mermaid", value: 4 },
  //   // { suit: "Cannon", value: 5 },
  //   // { suit: "Mermaid", value: 5 },
  //   // { suit: "Sword", value: 3 },
  //   // // SET
  //   // { suit: "Kraken", value: 4 },
  //   // { suit: "Anchor", value: 5 },
  //   // { suit: "Mermaid", value: 5 },
  //   // { suit: "Anchor", value: 3 },
  //   // // SET
  //   // { suit: "Kraken", value: 4 },
  //   // { suit: "Anchor", value: 5 },
  //   // { suit: "Chest", value: 5 },
  //   // { suit: "Key", value: 5 },
  //   // { suit: "Mermaid", value: 2 },
  //   // { suit: "Mermaid", value: 3 },
  //   // { suit: "Mermaid", value: 4 },
  //   // { suit: "Mermaid", value: 5 },
  //   // { suit: "Anchor", value: 3 },
  //   // SET
  //   { suit: "Kraken", value: 4 },
  //   { suit: "Kraken", value: 5 },
  //   { suit: "Map", value: 3 },
  // ];

  // Registry.Instance.players.push(
  //   new model.Player("0", "John"),
  //   new model.Player("1", "Jill"),
  //   new model.Player("2", "Ethan"),
  //   new model.Player("3", "Priya")
  // );
  // Coordinator.Instance.actionStartMatch(
  //   [0, 1],
  //   [
  //     ["Mermaid", 2],
  //     ["Anchor", 2],
  //     ["Mermaid", 3],
  //   ]
  // ); //TODO: remove

  //-- add set rreplacer
  app.set("json replacer", utils.fnSetMapSerializer);

  //TODO: add promise / next handling
  app.post(`/api/matches`, async (req: any, res) => {
    try {
      const data = req.body;

      if (!data.players) throw new Error("Missing players from input parameters.");
      if (!(data.players instanceof Array))
        throw new Error("Missing players from input parameters.");
      let players = new Array<model.PlayerId>(...data.players);
      let drawPile = data.drawPile;
      const match = await Coordinator.Instance.actionStartMatch(players, drawPile);
      if (!match) throw Error("Could not create match.");

      return res.json(utils.apifyMatch(match, data));
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.error(err);
      res.json({ error: err.message || err });
    }
  });

  app.get(
    `/api/matches`,
    // oidc.ensureAuthenticated(),
    async (req: any, res) => {
      try {
        const matches = Object.values(await Registry.Instance.getMatchesPromise());
        const params = req.body;

        return res.json(matches.map((match) => utils.apifyMatch(match, params)));
      } catch (err) {
        // tslint:disable-next-line:no-console
        console.error(err);
        res.json({ error: err.message || err });
      }
    }
  );

  app.get(
    `/api/matches/:id`, // TODO: add a from index param as well for easy polling
    // oidc.ensureAuthenticated(),
    async (req: any, res) => {
      try {
        const id = req.params.id;
        const data = req.body;

        const match = await Registry.Instance.getMatchByIdPromise(id);
        if (!match) throw Error("Match does not exist.");
        match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match.id);
        if (!match.move) throw Error("Consistency error - no move exist for match.");

        //TODO: check debug settings
        return res.json(utils.apifyMatch(match, data));
      } catch (err) {
        // tslint:disable-next-line:no-console
        console.error(err);
        res.json({ error: err.message || err });
      }
    }
  );

  //-- execute user action on an existing match
  app.post(
    `/api/matches/:id`, // TODO: add a from index param as well for easy polling
    // oidc.ensureAuthenticated(),
    async (req: any, res, next) => {
      try {
        const id = req.params.id;
        const data = req.body;

        const match = await Registry.Instance.getMatchByIdPromise(id);
        if (!match) throw Error("Match does not exist.");
        match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match.id);
        if (!match.move) throw Error("Consistency error - no move exist for match.");

        const events = await Coordinator.Instance.executeActionPromise(match, data);
        //if (!events) return res.send(404);
        if (!events) return next("Error processing request.");

        return res.json(utils.apifyEvents(events, data));
      } catch (err) {
        // tslint:disable-next-line:no-console
        console.error(err);
        res.json({ error: err.message || err });
      }
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
};
