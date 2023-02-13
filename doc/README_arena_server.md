SAP Labs CEE Hub Programming Competition 2023 - Arena Server
============================================================

This is the source code for the arena server for the SAP Labs CEE Hub Programming Competition 2023. The [public documentation](README_public.md) of the competition were made accessible to teams in the respective repository during the competition, while this part of the repository will be shared only afterwards to help teams keep focus.

# Deployment Landscape

slceepc2023-overview.drawio.png
## Arena Server in GCP
The Arena Server is a node.js 16+ application written in TypeScript.
It can be deployed locally and for the competition it is deployed as a [Google Cloud Platform](https://console.cloud.google.com/) App Engine WebApp on a free trial account provide easy access.   
The App runs in limited autoscaling mode, horizontally scaling 5-10 independent instances. As a single express app can serve multiple parallel calls this shall serve the 20 particpating teams well.

![image](/doc/architecture/slceepc2023-overview.drawio.png)

## Database in MongoDB Atlas
The webapp connects to the [MongoDB Atlas](https://mongodb.com/) database free M0 instance.   

Due to limitations of the M0 network traffic (10GB/week) there is an temporary update for an inexpensive M5 tier (50GB/week) imposing a mere ~4 USD for the complete competition week.

![image](/doc/architecture/slceepc2023-db.drawio.png)

## Tournament Application in AWS
The tournaments are handled is a separate [tournament application](https://spc2023.s3.eu-central-1.amazonaws.com/index.html) based on lambda calls and DynamoDB.   
Tournament Double Elimination scheme is implemented via manual administration via a local Excel file and VBA scripts.

## Timeout handling
Timeout handling for individual matches are handled in a twofold logic
1. __passive__: Arena Server checks timeout upon each execute call and upon timeout reject the call and calls turn skip logic, also notifying the opponent via the standard API.
2. __active__: tournament application implements a cron based (1 min trigger), adding timed workitems to a Amazon Simple Queue Service (SQS) to achive a 5-10 second API watchdog calls.

# Architecture Overview

## Express App
The application master is a HTTP server serving the socket.io service.   
This instance is used for express app handling.
Two different and independent express sub-apps are registered on top of the master express app.

| | |
|--- | --- |
| http server main entry point for socket.io | /index.ts and /services/socketio.service.ts | 
| API express app | /routes/api.ts | 
| Frontend express app | /routes/frontend.ts | 

![image](/doc/architecture/slceepc2023-arena_layers.drawio.png)

## API BACKEND
API Backend is responsible for accessing the database and responding to any request on the `/api/**` endpoint.

| | |
|--- | --- |
| master express app  | /index.ts | 
| express app         | /routes/api.ts | 
| controller          | /controller/match.controller.ts and other controllers in /controller/* | 
| service calls       | /services/game.logic.service.ts and other services in /services/* | 
| dba calls           | /services/dba.service.ts | 
| db calls            | /services/db.service.ts | 

## FRONTEND
Frontend is responsible for accessing the database and responding to any request on the `/matches/**` endpoint.

| | |
|--- | --- |
| master express app  | /index.ts | 
| express app         | /routes/frontend.ts | 
| controller          | /controller/frontend.controller.ts | 
| service calls       | /services/game.logic.service.ts | 
| dba calls           | /services/dba.service.ts | 
| db calls            | /services/db.service.ts | 
| EJS SSR render      | /views/match_list.ejs and views/match_detail.ejs | 
| JS CSR render       | /public/match_list.js and public/match_detail.js | 
| push updates        | socket subscribe on client side and push using socket.io | 
| further AJAX calls  | standard API calls on client side routed to API BACKEND | 

## SOCKET.IO for push updates
Socket.io unit is responsible for pushing any relevant databse updates to the subscribed clients in a broadcast mode using the [socket.io](https://socket.io/) server and client implementation.
| | |
|--- | --- |
| master express app  | /index.ts | 
| express app         | /routes/frontend.ts | 
| controller          | /controller/frontend.controller.ts |
| service             | /services/socketio.service.ts | 
| dba calls           | /services/dba.service.ts | 
| db calls            | /services/db.service.ts |

### Consistency and Concurrency
Arena server shall ensure that any interested parties (player1, player2, admin) does get the update even though the actual API call and state change happens on another instance.

Though instance affinity is selected as a preference, there is no guarantee that the API calls, and the frontend will end up on tha same app instance - especially when we are dealing with a standard two-multi-player game setup.   

There were two options to implement this
* socket.io clusters
* mongodb change streams.

For sake of simplicity mongodb change streams were implemented, thus each instance subscribes and gets notification about database updates.

### Selective updates
Selective updates on list of matches to specific players and specific matches are achieved via Socket.io rooms.

| Target page | Change type | Topic | Room (channel) |
| --- | --- | --- | --- |
| list page | game changes | `match:update:header` | playerid.date_as_ISO for all players and admin (e.g. `636438380ef778617e0e5b00_2023-02-01`) |
| details page | game update | `match:update:details` | match_matchid (e.g. `match_63d9052c84e46b15cc1b44dd`) |
| details page | game change new move | `move:insert:details` | match_matchid (e.g. `match_63d9052c84e46b15cc1b44dd`) |

## DATABASE Updates
MongoDB provides _mongodb change streams_ to which the client subscribes to get updates effectively.

* Backend is subscribing to `matches` and `moves` to provide socket.io push updates for the frontend.   
_NOTE:_ improvement potential to optimize _long http polls_ to use the change streams instead of retries.
* Backend is subscribing to `players` to update cache on player data change for both api and frontend.

# Configuration

## Runtime configuration
Runtime configuration and secrets are kept in environment variables either set locally e.g. by `/.vscode/launch.json` or in an environment specific manner `\app.yaml` for GCP or in case of e.g. Vercel via web configuration.   

Some of the variables are mandatory (in bold) while others come with a default.

Key configuration variables
  * __MONGODB_CONN_STRING__ - connection string to mongodb
  * __MONGODB_DBNAME__ - database name used with mongodb
  * __ADMIN_PASSWORD__ - admin user password
  * API_RETRY_TIMEOUT_MS - timeout for API HTTP long polls - e.g. 30000 ms
  * API_RETRY_DELAY_MS - poll frequency for API HTTP long polls - e.g. 1000 ms
  * NODE_ENV - see standard Node.Js - production is suitable where deplyoing transpiled code
  * PORT - server port - e.g. 8080
  * MAX_TIMEOUT_TURNEND - max number of timeouts leading to match termination - e.g. 5

_Note on tradeoffs_: Cloud providers support separate secret stores that are not used here as a tradeoff for sake of simplicity and the project scope.   
The environment variable approach enables easy change without keeping the hardcoded secrets in the code itself splitting all secrets to a local and non versioned `gcp_secret.yaml` file.

## GCP setup
Proper way would be adding a Terraform script to support Configuration-as-code yet unfortunately time and knowledge constraints yielded to manual GCP setup.

### How to Enable GCP

1. Register on https://console.cloud.google.com/appengine
   * create a new project

2. [How to Enable GCP](https://cloud.google.com/appengine/docs/standard/nodejs/building-app/creating-project).
   * select project
   * in IAM and Admin add *Storage Object Admin* and *Storage Object Viewer* to your user
   * enable billing
   * enable cloud build  
     _in IMA add Storage Object Viewer to the [0-0]{12}@cloudbuild.gserviceaccount.com	(having Cloud Build Service Account)_
   * use `npm run deploy` or `gcloud app deploy --quiet`
   * use `npm run browse` to open the frontend page
