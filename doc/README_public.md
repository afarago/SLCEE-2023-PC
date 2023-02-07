SAP Labs CEE Hub Programming Competition 2023
============

# Competition objective
The goal of each team is to implement a client to ace the [Dead-Man's-Draw](https://boardgamegeek.com/boardgame/149155/dead-mans-draw) card game using their language and tools of choice.

During the competition period there will be several practice tournaments, while the competition will close with a grand tournament where teams' solutions will compete against each other and the most victorious teams will ace the SLCEE-PC-2023.

# Competition flow
1. Teams register themselves to the organizers
2. Organizers enter the team with a generated passwordhash
   1. Organizers send the Player id and the passwordhash to the Team  
      e.g `{id: '636438380ee778617e6e5be8', password: 'playerpass'}`
3. Players implement a test client using the specification and the example clients
   1. Organizers publish example clients to a public repo beforehands
   2. Players test themselves on practice Matches and develop a good strategy
4. Organizers announce Practice Tournaments, where Players are challenged to compete. Organizers create appropriate Matches between the Players - e.g. around at the end of each day 3pm-4pm
   1. Teams are expectd to keep their solution up and running during the tournament and react to ongoing matches with their involvement with the logic below
      Teams host their solution either on any internet enabled local machine - e.g. dev laptop or may choose to publish their client in the cloud  
      _NOTE: This is an awesome opportunity to test Kyma, or any hyperscaler_
   2. Once all Matches are finished, Organizers announce ranking and winners
   3. Teams are expected to react on matches within a short amount of time (e.g. 30 seconds - tbd) time otherwise a central watchdog may terminate the match forcefully and announce the other team as winner.  

During the tournaments we will use [double elimination](https://en.wikipedia.org/wiki/Double-elimination_tournament). This means that teams are eliminated from the tournament when they lose against two opponents, i.e. every team has a second chance. When facing an opponent, the teams will play five matches against each other in a row and the winner will be the team winning more times. In case of a draw, subsequents matches will be played until a winner can be determined.
The status of the current tournament can be tracked on the [Tournament Status](https://spc2023.s3.eu-central-1.amazonaws.com/index.html) page. On the top of the page you can see the tournament's results, while on the bottom of the page the status of the currently running matches are displayed.

# Interfaces available
Game is available through a public server, the ___Arena___ as a collection of REST api's.
* [REST API](#rest-api-interface) with OpenAPI specification is available at [/api](https://slhpc2023.appspot.com/api), documented under [/docs](https://slhpc2023.appspot.com/docs) endpoint.
* [Web Frontend](#web-frontend-interface) Frontent UI available under [/matches](https://slhpc2023.appspot.com/matches).  
Eye fancy only, use this to enable easy comprehension for practice matches, do not use it for your programmatic / automated / competition scene.  
No uptime guarantee.

# Match
A Match is a game between two players. Can be created by the Organizers between any two Players or as a practice Match.

## Match Flow
### 1. Waiting for a valid Match
1. Team listens to the [/matches?active=true&wait=true&tags=GAMETAG](https://slhpc2023.appspot.com/api/matches?active=true&wait=true&tags=GAMETAG) endpoint.
2. Arena server returns any matches - if found
3. In absence - it will use "HTTP Long Polling" to wait and keep the connection for a longer period (e.g. 30 seconds), and then returns with an empty array ```[]```
4. Teams are advised to retry the polling to get informed on any new match announced
5. As a match is started the API endpoint returns with a list of matching Match Ids so user gets notified about a match start.  
   _NOTE: Organizers will start a one active match at a time for each team, so no teams should deal with simultaneous matches._

### 2. Playing the Match
1. Player checks the state of the match and eventually waits for his/her turn via.
   ```
   GET /api/matches/{matchid}?waitactive=true
   ```
   * Similary to the waiting for a match step, the arena server keeps the connection open to a longer period "HTTP Long Polling" (e.g. 30 sec) and returns with a ```409 - Authenticated user is not the current player``` code if the player is not the active. Players should retry this wait step.
   * If the match ended by the last action of the other player arena server returns ```410 - No action possible on finished matches``` with the list of closing events, so scores and winner can is known also by this player.
2. Player issues a `Draw` action via the API and waits for result via
   ``` 
   POST /api/matches/{matchid}
   { 
      "etype": "Draw" 
   }
   ```
   1. Player receives information on events resulted by the action in the response
   2. Upon turn start all changes of the playarea is delivered as a delta structure.
   3. If the card triggers an effect that requires user response (e.g. `Map`) and the effect is not nullified the user is expected to call the action API with the appropriate response via `ResponseToEffect`
   
   ```
   POST /api/matches/{matchid} - 
   { "etype": "ResponseToEffect", 
      "effect": {
        "effectType": "Hook",
        "card": {
            "suit": "Kraken",
            "value": 4
        }
      }
    }
    ```
   4. As any action can bust the turn, Players should check if the returned response contains a `TurnEnded` or even `MatchEnded` event. (Though Arena server will prevent any invalid actions, such as drawing a card when already the other player is on turn.)
3. After a number of cards player issues `EndTurn` action via 
   ``` 
   POST /api/matches/{matchid}
   { 
      "etype": "EndTurn" 
   }
   ```
   * Arena server returns the list of state change events similarly to `Draw` including a turn ended aggregate state delta
4. If busted or draw pile is exhaused turn ends automatically -- server adds a `TurnEnded` event in response.
5. If draw pile is exhaused and all effects are responded to match ends automatically and winner or a tie is announced -- server adds `MatchEnded` event in response.


# Development journey
Teams are not expected to ace the game at the first day, therefore a number of tools are at your disposal during the development journey to gradually excel with the result.

* Teams can onboard on ```/api/helloworld``` and then ```/api/whoami``` endpoints
* REST API is easier than you would think - use [web browser for testing](https://slhpc2023.appspot.com/api/hello), [curl](https://curl.se/), [PostMan](https://www.postman.com/) or even [Excel macros](https://learn.microsoft.com/en-us/office/dev/scripts/develop/external-calls), [Excel grid](https://www.conradakunga.com/blog/consuming-rest-json-apis-from-excel), using e.g. [restapiexample](http://dummy.restapiexample.com).
* Teams receive a number of example clients te ease development in most popular languages
* Teams can start and conduct any amount of Practice Matches to test game logic with the same user
* Teams can start and conduct any amount of Practice Matches to test game logic between the own user + _dummy user_ to test dialogue handling
* Teams can set initial state of the game to test out different situations in Practice Matches, and set randomization or even turn out randomization completely
* Teams can recreate and replay any match in Practice Matches
* Teams can use the autopick mechanism to neglect any abligation for Card Effect responses
* Teams can check relevant match results via a web browser, rendering all moves and match state

### Practice Match
A practice Match is a Match that is created by the Player itself, and contains twice the PlayerId or the PlayerId and the DummyId so that it can act as both sides of the table.  
For a practice Match extended amounts of information is optionally delivered via the API for easier debugging.

DummyPlayer is identified with `"000000000000000000000000":"dummypass"` accepting any match as an opponent.  
Be aware that you need to play with the dummyuser as well if you start a match with it.  
Be aware that dummyuser will receive many matches from other players as well - react only on matches you have started yourself, consider using a tag for such maches.

### Initial debug parameters
Practice match can be started with specifying any initial starting state with regards to draw, discard pile or banks. See the OpenAPI documentation for the parameters - check out `MatchCreationParams`.

#### Random seed
Practice match can be started with specifying the random seed so that a previous match can re replayed and any programming errors can be understood better.

Each game creation returns the random seed used or generated - check out `MatchCreateResponse`.

Special random seed parameter is `norandom` when areana server picks first available choice - useful for selection of initial player from players array or discard pile drawing on "Map" effect.

### Autopick
If the card triggers an effect that requires user response (e.g. Map) and the effect is not nullified the user is expected to call the action API with the appropriate response. with `ResponseToEffect`.

To ease the initial learning curve teams can use the autopick mechanism that provides an automatic answer for any card effects, though not the most strategically smart one - check out IUserAction.
```
{
    "etype": "ResponseToEffect",
    "autopick": "true"
}

{
    "etype": "Draw",
    "autopick": "true"
}

{
    "etype": "EndTurn",
    "autopick": "true"
}
```
## Creating your first match - simple example clients

The next few steps describes the steps necessary to set up a test match and connect two clients to play against each other. The text refers to the java client, but it can be replaced with your favorite one.

### Prerequisites for the Java client

* As a preparation please download the precompiled binary version of the java client "SpcJavaClient-1.0-SNAPSHOT-jar-with-dependencies.jar" from /example_clients/SPCJavaClient/taget.
* Please make sure that SapMachine 17 or any other Java 17 compatible JDK or JRE is installed on your system. Check that entering java --version in a comand prompt reports a java version 17 or higher.
* You also need a REST client to interactively create a match. We recommend Postman, but anything will do.

### Creating a match using Postman
- Using Postman create a POST request to the endpoint https://slhpc2023.appspot.com/api/matches.  
   In the body use the following text:  
``` 
   {  
      "playerids": ["<your user id>", "<dummy user id>"],  
      "tags": ["<something unique>"]  
   }   
``` 
  
The user id is the one we gave your team, the dummy user id is 000000000000000000000000.  

- Set up basic authentication with your user id and password.  
- Send the request.  
   The response returned from the arena server should look like this:  
``` 
   {  
      "id": "<match id>",  
      "randomSeed": "<random seed>"  
   }  
``` 

Both \<match id\> and \<random seed\> are unique strings. We will not use the random seed in this guide, but the match id is essential, as it identifies the match that you want to connect your clients to.

### Playing using the Java client

There are multiple ways to continue from here. Choose one that you like.

1) running two separate instances of the java client; one for each player.

   Run the following commands in separate terminal windows:  
```
   java -jar SpcJavaClient-1.0-SNAPSHOT-jar-with-dependencies.jar -g <match id> -p <user id> -pw <your password> -s https://slhpc2023.appspot.com
```

```
   java -jar SpcJavaClient-1.0-SNAPSHOT-jar-with-dependencies.jar -g <match id> -p 000000000000000000000000 -pw dummypass -s https://slhpc2023.appspot.com
```

2) running one instance, playing the role of both players.  
```
   java -jar SpcJavaClient-1.0-SNAPSHOT-jar-with-dependencies.jar -g <match id> -p <user id> -pw <your password> -p2 000000000000000000000000 -pw2 dummypass -s https://slhpc2023.appspot.com
```
3) waiting for a tag instead of connecting to the specific match. This is the recommended setup for competitions. We also add the -l parameter that forces the client to run in a loop, i.e. it will wait for a new match with the same tag after completing the previous one. The order in which you start the client and create the match is not important in this case, the connection will be established in both cases.
```
   java -jar SpcJavaClient-1.0-SNAPSHOT-jar-with-dependencies.jar -w -l -t <your unique tag> -p <user id> -pw <your password> -p2 000000000000000000000000 -pw2 dummypass -s https://slhpc2023.appspot.com
```
   Obviously, during a real competition you must not add the credentials of the dummy user as you want to run a single instance of the client on behalf of your own user.

### Playing using the Javascript/Node.js client

You will also find an example client written in Javascript using Node.js.

It will draw and on a random basis either draw a next card or end the turn.

#### Prerequisites

1. install nodejs from https://nodejs.org/en
2. navigate a console to the `example_clients\javascript` directory
3. install all dependencies by `npm install`

#### Starting the game

You can start the node client, wait for an active match for the user and play it through.  

```
node.exe _example_client_nodejs.js --u=<userid> --p=<password>
```

Additionally it is also possible to start a specific match.

```
node.exe _example_client_nodejs.js --u=<userid> --p=<password> --m=<matchid>
```

# REST API Interface
There is an extensive OpenAPI documentation under [/docs](https://slhpc2023.appspot.com/docs) path of the server.
The REST API works on JSON format.

Match request and Action execution endpoints works with a timeout with `wait=true` parameter specified to avoid constant polling. As there is a timeout of cc 30 sec, eventually the request needs to be restarted.

![image](https://user-images.githubusercontent.com/4489389/207619972-17cb5bf2-0d9c-4c66-8a22-8dac184429a4.png)

## High level API list
* `GET /api/matches` - get matches
* `POST /api/matches` - create a match
* `GET /api/matches/{id}` - get match status
* `POST /api/matches/{id}` - execute action

## Authentication
Digest or Basic authentication is used in the header with the username and passwordhash provided.

_NOTE: For the scope of the programming competition this is sufficient, sorry for not adding APIKey or JWT authentication. Rationale: we wanted to keep an entry level learning curve._

## Security, Fair play
The Areana server is a development artifact not thourougly tested for security flaws or performance bottlenecks. There were tests performed withstanding 100+ parallel users every second easily, yet that was not the main focus of the current implementation.

To keep chances fair, we expect all teams to respect arena integrity, report and not exploit any flaws to and solely the organizers right away.
To keep chances fair, we expect that each team polls server with the timeout frequency implemented (~30 sec) to avoid potential overload and denial of service.

## Timing
The organizers will start the tournament matches with a timeout setting, where any player is obligued to respond to the their turn within the given timeframe (e.g. 10 sec). This will keep a fair and clean tournament and ensures that all players have a chance to ace even if an opponent experiences technical difficulties.

# Web Frontend Interface
To ease comprehension teams can check relevant match results via a web browser, rendering all moves and match state.  
The frontent is accessible via  [/matches](https://slhpc2023.appspot.com/matches). An example gameplay of a match including user turns and moves look like this.
[![example gameplay](/doc/example_match_crop.png)](/doc/example_match.png)

This is how the a gameplay looks like from the frontend perspective.

https://user-images.githubusercontent.com/4489389/207584900-05192ace-eb59-4732-b364-63e53b0eb988.mp4

# Game rules

The game is a slightly simplified version of the popular [card game](/doc/rules/5b-dead-mans-draw-rulebook.pdf). 

Two players play against each other, their goal is to collect the highest number of cards and secure them in their own treasure chest.

One player starts the game. The players take turns and in each turn only one of the players is active. The active player draws cards one by one. After each draw he/she can finish the turn or draw another card. If the player stops drawing, all the cards drawn in the round can be moved to the player's chest. However, if a player keeps drawing and the type of a new card matches one already drawn in the same round, all the cards drawn in the round must be discarded and the round is completed without gaining anything. Every new card a player draws increases the potential value he/she can gain in the round but at the same time the chance of drawing a duplicate and completing the round with 0 points is increased as well.

There are 9 type of cards, all of them having 6 identical cards (54 in total). All of the 9 types affect the player's turn in a different way. When a duplicate is drawn it is discarded instantly together with the other cards without its ability affecting the round.

## Card Suits

![](/doc/suits/suit_anchor.png) **Anchor** - the cards drawn before the anchor are placed into the treasure chest even if the round ends with a duplicate.

![](/doc/suits/suit_cannon.png) **Cannon** - the player can choose a card from the other player's chest to discard (if the other player has at least one card in the chest).

![](/doc/suits/suit_sword.png) **Sword** - the next card must be choosen from the opponent's chest (if there is any). If a player chooses a card that matches one already drawn before (e.g. because there is only one card in the chest), the turn ends just as a duplicate was drawn and the cards must be discarded (except those protected by the anchor).

![](/doc/suits/suit_hook.png) **Hook** - the player must choose a card from his/her own chest (if there is any) and move it back to the play field. The card must be treated as it was drawn, i.e. the action based on its type must be executed. If a player chooses a card that matches one already drawn before (e.g. because there is only one card in the chest), the turn ends just as a duplicate was drawn and the cards must be discarded (except those protected by the anchor).

![](/doc/suits/suit_oracle.png) **Oracle** - player can look at the next card before deciding to stop the round or draw the card.

![](/doc/suits/suit_map.png) **Map** - the player must choose the next card from three cards randomly selected from the discarded ones. One must be choosen even if it completes the turn by being a duplicate. If there is no three cards in the discarded set, then the player must choose from less options. If there is no discarded card, then the next card must be drawn the standard way.

![](/doc/suits/suit_kraken.png) **Kraken** - the player has two draw two additional cards before stopping. If the first drawn card is a sword, map or hook, the next card counts towards the two regardless where it was drawn from.

![](/doc/suits/suit_chest.png) ![](/doc/suits/suit_key.png) **Chest & Key** - these cards have no special ability, but when both of these cards are drawn in a round and the player decides to stop (i.e. the turn does not end by drawing a duplicate) the player can move twice as many card to his chest that he/she would normally do. The additional cards are selected randomly from the discarded pack. If there are less cards discarded than the number of cards drawn, then all the discarded cards are moved to the player's chest.

## Game End

The game ends when there are no more cards to draw. The player having the highest sum of the topmost cards in his/her treasure chest wins the game.

## FAQ and small details
* How Kraken card behaves with any subsequent effects?
  * Kraken must draw two cards - if drawpile allows
  * Kraken practically ignores the first card's Oracle effect, as you will need draw a second card anyhow
  * if first card successfully triggers effect (Hook, Map, Sword) that places a second card to the playarea, no forced second draw is triggered
  * if card effect for first Kraken-pulled-card cannot be fulfilled, thus is nullified, the second card needs to be drawn (e.g. Kraken->Map(empty discardpile)->[draw second], Kraken->Hook(with empty bank)->[draw second], Kraken->Sword(with empty or all existing suit stacks)->[draw second] ))
  * as stated in the rules, you must perform Kraken if you can, even if it busts your turn.
* Sword effect is not allmighty
   * Sword effect cannot pick enemy Suit from which own Player already has someting in its Bank, yet not taking anything on the PlayArea in account
* Bonus cards on short or empty drawpile
   * Chest & Key draws from the DiscardPile randomly, bad luck if there are no or not enough cards for you in the pile
* DiscardPile initial state
   * _DiscardPile_ is initially filled with the smallest of each suit