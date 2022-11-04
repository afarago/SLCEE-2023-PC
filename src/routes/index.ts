import * as express from "express";
import * as api from "./api";
import * as frontend from "./frontend";

export const register = (app: express.Application) => {
  frontend.register(app); //TODO: consuder "/api" router object - http://expressjs.com/en/api.html#express.router
  api.register(app);
};
