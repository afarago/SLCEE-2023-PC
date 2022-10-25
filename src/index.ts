import dotenv from "dotenv";
import express from "express";
import path from "path";
// import * as sessionAuth from "./middleware/sessionAuth";
import * as routes from "./routes";

// initialize configuration
dotenv.config();

// port is now available to the Node.js runtime
// as if it were an environment variable
const port = process.env.SERVER_PORT ?? 8080;

const app = express();

// Configure Express to parse incoming JSON data
app.use(express.json());

// Configure Express to use EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Configure Express to serve static files in the public folder
app.use(express.static(path.join(__dirname, "public")));

// // Configure session auth
// sessionAuth.register( app );

// Configure routes
routes.register(app);

// define a route handler for the default home page
app.get("/", (req, res) => {
  // render the index template
  res.render("index");
});

// start the express server
app.listen(port, () => {
  // tslint:disable-next-line:no-console
  console.log(`server started at http://localhost:${port}`);
});

// https://developer.okta.com/blog/2018/11/15/node-express-typescript#easily-add-authentication-to-node-and-express
