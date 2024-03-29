# Banana client

For linux
```
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
add this line to ~/.profile : `export PATH=~/.npm-global/bin:$PATH`
source ~/.profile
```

0) install typescript npm install -g typescript
1) go into the lib folder
2) run npm i
3) run npm run build
4) go back to project folder
5) run npm i
6) run npm run link
7) run npm run start ... this will force rebuild and start client

to autocompile Typescript to Javascript press ctrl+shift+B and select tsc:watch .. autocompile will happen at save


# stary help - spc22_arena

Spc22Arena - JavaScript client for spc22_arena
SPC 22 Arena desciption
This SDK is automatically generated by the [OpenAPI Generator](https://openapi-generator.tech) project:

- API version: 1.0.0
- Package version: 1.0.0
- Build package: org.openapitools.codegen.languages.JavascriptClientCodegen

## Installation

### For [Node.js](https://nodejs.org/)

#### npm

To publish the library as a [npm](https://www.npmjs.com/), please follow the procedure in ["Publishing npm packages"](https://docs.npmjs.com/getting-started/publishing-npm-packages).

Then install it via:

```shell
npm install spc22_arena --save
```

Finally, you need to build the module:

```shell
npm run build
```

##### Local development

To use the library locally without publishing to a remote npm registry, first install the dependencies by changing into the directory containing `package.json` (and this README). Let's call this `JAVASCRIPT_CLIENT_DIR`. Then run:

```shell
npm install
```

Next, [link](https://docs.npmjs.com/cli/link) it globally in npm with the following, also from `JAVASCRIPT_CLIENT_DIR`:

```shell
npm link
```

To use the link you just defined in your project, switch to the directory you want to use your spc22_arena from, and run:

```shell
npm link /path/to/<JAVASCRIPT_CLIENT_DIR>
```

Finally, you need to build the module:

```shell
npm run build
```

#### git

If the library is hosted at a git repository, e.g.https://github.com/GIT_USER_ID/GIT_REPO_ID
then install it via:

```shell
    npm install GIT_USER_ID/GIT_REPO_ID --save
```

### For browser

The library also works in the browser environment via npm and [browserify](http://browserify.org/). After following
the above steps with Node.js and installing browserify with `npm install -g browserify`,
perform the following (assuming *main.js* is your entry file):

```shell
browserify main.js > bundle.js
```

Then include *bundle.js* in the HTML pages.

### Webpack Configuration

Using Webpack you may encounter the following error: "Module not found: Error:
Cannot resolve module", most certainly you should disable AMD loader. Add/merge
the following section to your webpack config:

```javascript
module: {
  rules: [
    {
      parser: {
        amd: false
      }
    }
  ]
}
```

## Getting Started

Please follow the [installation](#installation) instruction and execute the following JS code:

```javascript
var Spc22Arena = require('spc22_arena');

var defaultClient = Spc22Arena.ApiClient.instance;
// Configure HTTP basic authorization: basic
var basic = defaultClient.authentications['basic'];
basic.username = 'YOUR USERNAME'
basic.password = 'YOUR PASSWORD'

var api = new Spc22Arena.DiagnosticApi()
api.getAuthenticatedUser().then(function(data) {
  console.log('API called successfully. Returned data: ' + data);
}, function(error) {
  console.error(error);
});


```

## Documentation for API Endpoints

All URIs are relative to *http://localhost:8080*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*Spc22Arena.DiagnosticApi* | [**getAuthenticatedUser**](docs/DiagnosticApi.md#getAuthenticatedUser) | **GET** /api/whoami | Returns authenticated User
*Spc22Arena.DiagnosticApi* | [**getMessage**](docs/DiagnosticApi.md#getMessage) | **GET** /api/hello | Hello world ping message
*Spc22Arena.GameApi* | [**createMatch**](docs/GameApi.md#createMatch) | **POST** /api/matches | Creates a new Match
*Spc22Arena.GameApi* | [**executeActionForMatch**](docs/GameApi.md#executeActionForMatch) | **POST** /api/matches/{id} | Execute an Action for a Match
*Spc22Arena.GameApi* | [**getMatch**](docs/GameApi.md#getMatch) | **GET** /api/matches/{id} | Retrieves a Match details
*Spc22Arena.GameApi* | [**getMatches**](docs/GameApi.md#getMatches) | **GET** /api/matches | Retrieves all Matches
*Spc22Arena.PlayersApi* | [**getPlayer**](docs/PlayersApi.md#getPlayer) | **GET** /api/players/{id} | Retrieves a Player details
*Spc22Arena.PlayersApi* | [**getPlayers**](docs/PlayersApi.md#getPlayers) | **GET** /api/players | Retrieves Player information


## Documentation for Models

 - [Spc22Arena.AutoPickOptions](docs/AutoPickOptions.md)
 - [Spc22Arena.Card](docs/Card.md)
 - [Spc22Arena.CardEffect](docs/CardEffect.md)
 - [Spc22Arena.CardEffectResponse](docs/CardEffectResponse.md)
 - [Spc22Arena.CardEffectType](docs/CardEffectType.md)
 - [Spc22Arena.CardSuit](docs/CardSuit.md)
 - [Spc22Arena.CardValue](docs/CardValue.md)
 - [Spc22Arena.DrawCardPile](docs/DrawCardPile.md)
 - [Spc22Arena.ErrorResponse](docs/ErrorResponse.md)
 - [Spc22Arena.HelloWorldResponse](docs/HelloWorldResponse.md)
 - [Spc22Arena.IStateDelta](docs/IStateDelta.md)
 - [Spc22Arena.IStateDeltaStack](docs/IStateDeltaStack.md)
 - [Spc22Arena.IUserAction](docs/IUserAction.md)
 - [Spc22Arena.MatchActionType](docs/MatchActionType.md)
 - [Spc22Arena.MatchCreateResponse](docs/MatchCreateResponse.md)
 - [Spc22Arena.MatchCreationParams](docs/MatchCreationParams.md)
 - [Spc22Arena.MatchEventType](docs/MatchEventType.md)
 - [Spc22Arena.MatchResponse](docs/MatchResponse.md)
 - [Spc22Arena.MatchResponseReturned2](docs/MatchResponseReturned2.md)
 - [Spc22Arena.PartialPickMatchEventActionResponseReturnedProps](docs/PartialPickMatchEventActionResponseReturnedProps.md)
 - [Spc22Arena.PartialPickMatchEventActionResponseReturnedPropsResponseToEffectCard](docs/PartialPickMatchEventActionResponseReturnedPropsResponseToEffectCard.md)
 - [Spc22Arena.PickMatchMatchResponseReturnedProps](docs/PickMatchMatchResponseReturnedProps.md)
 - [Spc22Arena.PickPlayerPlayerResponseReturnedProps](docs/PickPlayerPlayerResponseReturnedProps.md)
 - [Spc22Arena.State](docs/State.md)
 - [Spc22Arena.WhoAmiIResponse](docs/WhoAmiIResponse.md)


## Documentation for Authorization



### basic

- **Type**: HTTP basic authentication

