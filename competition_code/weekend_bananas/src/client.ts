import { get_best_move } from "./functions";

var Spc22Arena = require("spc22_arena");

const pressAnyKey = require("press-any-key");
const params = require("yargs")
  .option("u", {
    alias: "username",
    demandOption: false,
    type: "string",
    default: "63cfb5630f032e987d2a7248",
  })
  .option("p", {
    alias: "password",
    demandOption: false,
    type: "string",
    default: "5xFatt449Ls2AqAa",
  })
  .option("m", {
    alias: "matchid",
    demandOption: false,
    type: "string",
  })
  .option("wait", {
    alias: "w",
    demandOption: false,
    type: "boolean",    
  })
  .help().argv;

console.log("input params: ", params);

const defaultClient = Spc22Arena.ApiClient.instance;
//defaultClient.basePath = "http://localhost:8080";
defaultClient.basePath = "https://slhpc2023.appspot.com";
const basic = defaultClient.authentications["basic"];
const _matcheventyypes = new Spc22Arena.MatchEventType();

console.log(`Using server: ${defaultClient.basePath}`);

export function start_client(){
  // Configure HTTP basic authorization: basic
  basic.username = params.username;
  basic.password = params.password;

  console.log(`Playing as user: ${basic.username}.\n`);

  require("util").inspect.defaultOptions.depth = null;
  new Promise(async () => main(params.matchid)).then();

}


async function main(matchid) {
  console.log("-----------********************************************************************************------------");
  console.log("-----------********************** VERSION --- PIATOK - 14:00 *****************************------------");
  console.log("-----------********************************************************************************------------");
  console.log("");
  console.log(await getHello());

  if (matchid) {
    //-- using matchid from the param to play with
    const match = await get_match_by_id(matchid);
    await play_a_match(match);
  } else {
    //-- continue in a loop: wait for a match and play that match
    while (true) {
      //-- receive match to play with
      const match = await wait_for_active_match();
      //-- play with the match
      await play_a_match(match);
    }
  }
}

async function getHello() {
  var api = new Spc22Arena.DiagnosticApi();
  //api.getAuthenticatedUser().then(console.log);
  const response = await api.getMessage();
  return response?.message;
}

async function get_match_by_id(matchid) {
  var gameapi = new Spc22Arena.GameApi();

  const retval = await gameapi.getMatch(matchid);
  return retval;
}

async function wait_for_active_match() {
  var gameapi = new Spc22Arena.GameApi();
  var opts = { at: "today", wait: "1", active: "1" };

  let matches = null;
  console.log(
    `\n${"=".repeat(80)}\nWaiting for matches where player ${
      basic.username
    } is active...`
  );
  while (!(Array.isArray(matches) && matches?.length > 0)) {
    matches = await gameapi.getMatches(opts);
  } //-- end:WAITMATCH

  if (Array.isArray(matches)) {
    //NOTE: what to do when there are multiple matches available - now: just pick first and play with it
    const picked_match = matches[0];
    return picked_match;
  }
}

function move_has_event(move, targetEventType) {
  try {
    return move?.find((item) => item?.eventType == targetEventType);
  } catch {
    console.log(move);
  }
}

async function play_a_match(match) {
  const matchid = match._id?.toString();
  console.log(`Using ${matchid} for the game`);

  var gameapi = new Spc22Arena.GameApi();
  //-- MATCH: Repeat turns as slong as possible
  let turncount = 0;
  let isMatchRunning = true;
  let lastmove = undefined;
  while (isMatchRunning) {
    //-- guard match ended
    if (move_has_event(lastmove, _matcheventyypes.MatchEnded)) {
      console.log("Match has ended");
      isMatchRunning = false;
      break;
    }

    console.info(
      `\n=== TURN #${++turncount} ==================================`
    );
    //-- TURN: Draw a few cards
    while (isMatchRunning) {

      try {
        if (params.wait) await pressAnyKey().then(); //'Press any key to continue...'        

        // NOTE: Here I choose to perform a "draw of card" whatever happens in the meantime,
        // for this I call the executeActionForMatch API call (POST /api/matches) and implement the long-polling wait there with 200/409 status.
        // NOTE: Another feasible choice is to call the getMatch with waitactive=true parameter (GET /api/matches/<matchid>?waitactive=true) and implement the long-polling wait there with 200/409 status
        // whis would enable you to first check what the other player has done, the execute the drawing of card

        // get game status
        var opts = { waitactive: "1", showevents: "1" };

        let waitOnMyMove = true;
        let gameStatus = undefined;
        while (waitOnMyMove) {
          gameStatus = await gameapi
            .getMatch(matchid, opts)
            .then((result) => {
                //console.log(JSON.stringify(result, null, 2));
                waitOnMyMove = false;
                return result;
            })
            .catch((err) => {
            
              if (err?.status === 409) {
                console.log( "[409] ... I am still not the current player - retrying get game status..." );
                return err;
              } else {
                console.log( "[" + err?.status + "] getMatch error "  );
                throw err;
              }
            });
        }

        // get move for game
        const bestMove = get_best_move(gameStatus)
        console.info(bestMove.info);

        // execute move

        
        lastmove = await gameapi
            .executeActionForMatch(matchid, bestMove.userAction, bestMove.opts)
            .then((result) => {
              // console.log(JSON.stringify(result, null, 2));
              let retryMove = false; //-- successfully submitted move
              return result;
            })
            .catch((err) => {              
              // strage - move failed form some unknown reason             
                console.log( "[" + err?.status + "] move execution error - may be not valid move?" );
                return err;              
            });
        

        //-- check whether turn has ended by itself (bust or matchend)
        if (move_has_event(lastmove, _matcheventyypes.TurnEnded)) break;
        if (move_has_event(lastmove, _matcheventyypes.MatchEnded)) {
          isMatchRunning = false;
          break;
        }
        
      } catch (err) {
        if (err.status) {
          console.error(err?.status, err?.response?.text);
          try {
            const jsonobj = JSON.parse(err?.response?.text)?.events;
            if (jsonobj) lastmove = jsonobj;
          } catch {}
        } else console.log("Error", err);
        isMatchRunning = false;
        break;
      }
    } //-- end:TURN
  } //-- end:MATCH

  //-- read match end status and display
  const ri_matchend = move_has_event(lastmove, _matcheventyypes.MatchEnded);
  if (ri_matchend) {
    const endstatus =
      typeof ri_matchend.matchEndedWinnerIdx !== "number"
        ? "TIE"
        : match.playerids[ri_matchend.matchEndedWinnerIdx]?.toString() ===
          basic.username
        ? "WON"
        : "LOST";
    console.log(
      `\nMATCHEND [${matchid}]: ${endstatus}`,
      `winnerIdx:${ri_matchend.matchEndedWinnerIdx} scores:${ri_matchend.matchEndedScores}`
    );
  }
}
