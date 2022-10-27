import * as express from "express";
import * as api from "./api";
import * as frontend from "./frontend";

export const register = (app: express.Application) => {
  frontend.register(app);
  api.register(app);
};
