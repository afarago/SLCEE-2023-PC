import "core-js/es/array/at";
import cloneDeep from "lodash/cloneDeep";
//import cloneDeepWith from "lodash/cloneDeepWith";

import Registry from "./registry";
import * as model from "./model/model";
import * as utils from "../utils";
import { CardSuit, Card } from "./model/model";

//TODO: Kraken->Cannon->Oracle //BUG: not working yet

/**
 * Coordinator class, main game controller
 */
export default class Coordinator {
  /**
   * Creates a Move object on the global match
   * @param match
   * @returns move
   */
  private static newMove(match: model.Match): model.Move {
    //-- copy state over frm previous move state to keep continuity
    //-- no need to clone state, we can easily sacrifice the state of the previous move as it wa salready persisted
    const move = new model.Move(match._id, match.move?.state);
    move.sequenceId = match.move ? match.move?.sequenceId + 1 : 0;
    return move;
  }

  /**
   * Persists move promise
   * @param move
   */
  private static async persistMovePromise(move: model.Move) {
    await Registry.Instance.createMovePromise(move);
  }

  /**
   * Persists update match promise
   * @param match
   */
  private static async persistUpdateMatchPromise(match: model.Match) {
    match.updateHeader();
    await Registry.Instance.updateMatchPromise(match);
  }

  /**
   * Adds event to the Match/Move
   * @param move
   * @param event
   * @param oldState
   * @returns event added event
   */
  private static addEvent(
    move: model.Move,
    event: model.MatchEvent,
    oldState: model.MatchState
  ): model.MatchState {
    //-- copy state to new state
    const state = model.MatchState.clone(oldState);
    event.state = state;

    move.addEvent(event);
    if (move.initialState) delete move.initialState;

    return state;
  }

  /**
   * responds to user action to start a match
   * @param players
   * @param [initialDrawPile]
   * @returns started match
   */
  public static async actionStartMatch(
    players: Array<string>,
    initialDrawPile?: Array<any>
  ): Promise<model.Match> {
    console.log(">START_MATCH", players);

    //-- check if all players exists and there is exactly 2 players
    const playerdata = await Registry.Instance.getPlayerByIdsPromise(players);
    if (playerdata.length != 2 || playerdata.some((pd) => !pd))
      throw new Error("Invalid players specified, please check settings.");

    let match = new model.Match(playerdata?.map((player) => player._id));

    await Registry.Instance.putMatchPromise(match); //match.persist():
    console.log("MATCH_STARTS:", match._id.toString());

    //-- testing lodash array clone problems
    // class CardPileArrTest extends Array<model.Card> {
    //   testint: number;
    // }
    // let z = new model.CardPileArrTest();
    // z.testint = 12;
    // const fnCustomizer = (value: any, idx_key: any, obj: any, stack:any): any => {
    //   console.log(value);
    //   return undefined; //-- do not resolve
    // };
    // let z1 = cloneDeepWith(z, fnCustomizer) as model.CardPileArrTest;
    // let z2 = cloneDeep(z) as model.CardPileArrTest;
    // console.log(z, z1, z2);

    const move = (match.move = Coordinator.newMove(match));
    {
      //-- announce match starting
      let startingState = Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.MatchStarted),
        new model.MatchState()
      );

      startingState.currentPlayerIndex = Math.floor(Math.random() * match.numberOfPlayers);
      startingState.banks = Array(match.numberOfPlayers)
        .fill(null)
        .map(() => new model.Bank()) as Array<model.Bank>;
      startingState.playArea = new model.PlayArea();
      startingState.discardPile = new model.FlatCardPile();
      startingState.drawPile = model.DrawCardPile.create(initialDrawPile);
    }

    //-- announce turn starting
    Coordinator.turnStarting(match, move, match.state.currentPlayerIndex);

    //-- return event
    await Coordinator.persistMovePromise(match.move);
    await Coordinator.persistUpdateMatchPromise(match);
    return match;
  }

  /**
   * responds to user actions
   * @param match
   * @param data
   * @returns promise to action
   */
  public static async executeActionPromise(
    match: model.Match,
    data: any
  ): Promise<Array<model.MatchEvent>> {
    // console.log(">ACTION:", data.etype);

    // Safeguards:
    if (match.isFinished) throw new Error("No action possible on finished matches");
    // - only accept ResponseToEffect if pending effectresponse
    const pendingEffect = match.state.pendingEffect;
    if (pendingEffect) {
      if (!pendingEffect)
        throw new Error("Incorrect event registry, while processing CardPlayedEffect");
      if (data.etype != "ResponseToEffect")
        throw new Error("Respond to pending effect first: " + pendingEffect.effectType);
      if (pendingEffect?.effectType != data.effect?.effectType)
        throw new Error(
          "Respond correctly to the pending effect first: " +
            pendingEffect.effectType +
            " response: " +
            data.effect?.effectType
        );
    }

    //-- act according to the event type
    if (data.etype == "Draw") {
      await Coordinator.actionDraw(match);
    } else if (data.etype == "EndTurn") {
      await Coordinator.actionEndTurn(match);
    } else if (data.etype == "ResponseToEffect") {
      await Coordinator.actionRespondToEffect(match, data.effect, pendingEffect);
    } else {
      throw new Error("Unknown action verb: " + data.etype);
    }

    //-- return generated events
    await Coordinator.persistMovePromise(match.move);
    await Coordinator.persistUpdateMatchPromise(match);

    //--
    //TODO: update match (moveCount, lastMoveAt, currentPlayer(isFinished))

    return match.move?.getEvents();
  }

  /**
   * responds to user action to end a turn
   * @param match
   * @returns void promise
   */
  private static async actionEndTurn(match: model.Match): Promise<void> {
    console.log(">ENDTURN");

    //-- CHECK: are there any cards on the play area
    const state = match.state;
    if (state.playArea.length == 0) throw new Error("Cannot end turn with empty playarea.");

    //-- add initiator
    const move = (match.move = Coordinator.newMove(match));

    Coordinator.addEvent(move, new model.MatchEvent(model.OMatchEventType.EndTurn), state);

    //-- initiate forced turn end
    Coordinator.turnEnding(match, move, true);
  }

  /**
   * Draws a card from drawpile
   * @param match selected match
   * @param move selected move
   * @param [doRemoveFromPile] whether to remove item from the drawpile
   * @returns card drawn
   */
  private static drawCard(
    match: model.Match,
    move: model.Move,
    doRemoveFromPile: boolean = true
  ): model.Card {
    const state = match.state;

    //-- if drawpile is exhausted - annotation match end
    if (state.drawPile.length == 0) {
      //-- do a standard tun ending and collection, this will trigger the match end
      //-- Warning: this could result in endless stack, when drawPile is empty + one gets bonus cards -> extra conditional at bonus assignment
      Coordinator.turnEnding(match, move, true);
      return null;
    }

    //-- execute the draw
    const cardDrawn = state.drawPile.draw(doRemoveFromPile);

    //-- event only - if removed
    if (doRemoveFromPile)
      Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.Draw, { drawCard: cardDrawn }),
        state
      );

    console.log(doRemoveFromPile ? "DRAW_CARD:" : "PEEK_CARD:", cardDrawn);

    return cardDrawn;
  }

  /**
   * Places card to the playarea
   * @param match selected match
   * @param move selected move
   * @param card selected card
   * @returns card
   */
  private static placeCard(match: model.Match, move: model.Move, card: model.Card): model.Card {
    //== place card to playarea
    //-- check for busted
    const isSuccessful = match.state.playArea.cards.find((c) => c.suit == card.suit) == null;
    if (!isSuccessful) {
      //-- busted
      console.log("PLACE_CARD:", card, "area:", JSON.stringify(match.state.playArea), "BUSTED!");
      Coordinator.discardCard(match, move, card);
      Coordinator.turnEnding(match, move, isSuccessful);
      return null;
    }

    //-- add drawn card
    {
      const state = Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.CardPlacedToPlayArea, {
          cardPlacedToPlayAreaCard: card,
        }),
        match.state
      );
      state.playArea.cards.push(card);

      console.log("PLACE_CARD:", card, "area:", JSON.stringify(state.playArea));
    }

    //-- maintain and check if Kraken forced card is fulfulled
    if (match.state.pendingKrakenCards) {
      --match.state.pendingKrakenCards;
      console.log("PLACE_CARD - DEBUG: Kraken pending", match.state.pendingKrakenCards);
    }

    //================================================================
    //=== EFFECTs ====================================================
    //-- execute effects based on Suit special

    //=== KRAKEN effect =====================================
    if (card.suit === model.OCardSuit.Kraken) {
      match.state.pendingKrakenCards = 2;

      while (match.state.pendingKrakenCards) {
        //-- if there are any pending effects, that means that there is no need to draw the next kraken card
        //-- e.g. map, hook or sword - we skip  oracly with a condition on pendingKrakenCards
        if (match.state.drawPile.length === 0 || match.pendingEffect) {
          console.log("CARDEFFECT:", card.suit, "terminated");
          match.state.pendingKrakenCards = 0;
          break;
        }
        console.log("CARDEFFECT:", card.suit);

        const cardDrawnKraken = Coordinator.drawCard(match, move, true);
        if (!cardDrawnKraken) break; //-- empty deck will break here
        const cardPlacedKraken = Coordinator.placeCard(match, move, cardDrawnKraken);
        if (!cardPlacedKraken) break; //-- busted will break here
      }
    }

    //=== ORACLE effect =====================================
    else if (card.suit === model.OCardSuit.Oracle) {
      //-- if drawpile is empty or there is a kraken in progress, just skip
      if (match.state.drawPile.length > 0 && !match.state.pendingKrakenCards) {
        const cardPeekedOracle = Coordinator.drawCard(match, move, false);
        const effect = new model.CardEffect(model.OCardEffectType.Oracle, {
          card: cardPeekedOracle,
        });
        {
          const state = Coordinator.addEvent(
            move,
            new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
              cardPlayedEffect: effect,
            }),
            match.state
          );
          state.addPendingEffect(effect);
          state.drawPile.nextCard = cardPeekedOracle;
        }
        console.log("CARDEFFECT:", card.suit, ":", cardPeekedOracle, "[requires user response]");
      } else {
        console.log(
          "CARDEFFECT:",
          card.suit,
          ":",
          "ignored - due to empty drawpile or pending kraken."
        );
      }
    }

    //=== HOOK effect =====================================
    else if (card.suit === model.OCardSuit.Hook) {
      const bank = match.state.banks[match.state.currentPlayerIndex];
      //-- if own bank has no elements, just skip
      if (bank.flatSize > 0) {
        const effect = new model.CardEffect(model.OCardEffectType.Hook);
        {
          const state = Coordinator.addEvent(
            move,
            new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
              cardPlayedEffect: effect,
            }),
            match.state
          );
          state.addPendingEffect(effect);
        }
        console.log("CARDEFFECT:", card.suit, "[requires user response]");
      } else {
        console.log("CARDEFFECT:", card.suit, ":", "ignored - due to empty bank");
      }
    }

    //=== CANNON, SWORD effect =====================================
    else if (card.suit === model.OCardSuit.Cannon || card.suit === model.OCardSuit.Sword) {
      //-- if no other player bank has elements, just skip
      //--  important: Sword cannot choose from suitstack that exists in our bank, while Cannon can pick any
      const anyItemsInAnyBanksFromDifferentSuits = Coordinator.checkIfWeCanPickFromOtherBanks(
        match,
        card
      );
      if (anyItemsInAnyBanksFromDifferentSuits) {
        const effect =
          card.suit === model.OCardSuit.Cannon
            ? new model.CardEffect(model.OCardEffectType.Cannon)
            : new model.CardEffect(model.OCardEffectType.Sword);
        {
          const state = Coordinator.addEvent(
            move,
            new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
              cardPlayedEffect: effect,
            }),
            match.state
          );
          state.addPendingEffect(effect);
        }
        console.log("CARDEFFECT:", card.suit, "[requires user response]");
      } else {
        console.log(
          "CARDEFFECT:",
          card.suit,
          ":",
          "ignored - due to empty or same_suited enemy banks"
        );
      }
    }

    //=== MAP effect =====================================
    else if (card.suit === model.OCardSuit.Map) {
      //-- if discard pile has no elements, just skip
      if (match.state.discardPile.length > 0) {
        //-- remove (temp) cards from discard pile, until effect is fulfulled
        const cardsFromDiscard = Coordinator.drawCardsFromDiscardPile(match, move, 3); //TODO:!! should modify state only after!
        const effect = new model.CardEffect(model.OCardEffectType.Map, {
          cards: cardsFromDiscard,
        });
        {
          const state = Coordinator.addEvent(
            move,
            new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
              cardPlayedEffect: effect,
            }),
            match.state
          );
          state.addPendingEffect(effect);

          console.log(
            "CARDEFFECT:",
            card.suit,
            ":",
            JSON.stringify(cardsFromDiscard),
            "[requires user response]"
          );
        }
      } else {
        console.log("CARDEFFECT:", card.suit, ":", "ignored - due to empty discardpile");
      }
    }

    return card;
  }

  /**
   * Checks if we can pick from other banks - useful for starting interaction on e.g. Map and Sword
   * @param match selected match
   * @param card selected card
   * @returns if we can really pick
   */
  private static checkIfWeCanPickFromOtherBanks(match: model.Match, card: model.Card): boolean {
    //-- check if any other player has banks that are or to pick from
    //-- #1 should not be not empty
    //-- #2 Sword cannot choose from suitstack that exists in our bank, while Cannon can pick any
    const currentBank = match.state.banks[match.state.currentPlayerIndex];
    const anyItemsInAnyBanksFromDifferentSuits = !!match.state.banks.find(
      (bank) =>
        bank != currentBank &&
        bank.flatSize > 0 &&
        //-- sword cannot pick from suitstack that exists in out bank
        (card.suit !== model.OCardSuit.Sword ||
          [...bank.piles.keys()].some((bps) => !currentBank.piles.has(bps)))
    );
    return anyItemsInAnyBanksFromDifferentSuits;
  }

  /**
   * Moves a card to discardpile
   * @param match selected match
   * @param move selected move
   * @param card selected card
   */
  private static discardCard(match: model.Match, move: model.Move, card: model.Card): void {
    console.log("DISCARD:", card);
    move.state.discardPile.cards.push(card);
  }

  /**
   * Draws cards from discard pile
   * @param match selected match
   * @param move selected move
   * @param numberOfCards target number of cards (can be less if not available)
   * @returns cards from discard pile
   */
  private static drawCardsFromDiscardPile(
    match: model.Match,
    move: model.Move,
    numberOfCards: number
  ): Array<model.Card> {
    const cardsFromDiscard = new Array<model.Card>();
    //TODO: add new state transition!
    for (let i = 0; i < numberOfCards; i++) {
      if (!match.state.discardPile.length) break;

      let idx = Math.floor(Math.random() * match.state.discardPile.length);
      let card = match.state.discardPile.cards[idx];

      cardsFromDiscard.push(card);

      match.state.discardPile.cards.splice(idx, 1);
      console.log("DRAW_CARD_DISCARDPILE:", card);
    }
    return cardsFromDiscard;
  }

  /**
   * execute user action to draw a card
   * @param match selected match
   * @returns void promise
   */
  private static async actionDraw(match: model.Match): Promise<void> {
    console.log(">DRAW");
    const move = (match.move = Coordinator.newMove(match));

    const card = Coordinator.drawCard(match, move);
    if (card) Coordinator.placeCard(match, move, card);
  }

  /**
   * Match ending event
   * @param match selected match
   * @param move selected move
   * @returns void promise
   */
  public static async matchEnding(match: model.Match, move: model.Move): Promise<void> {
    console.log("MATCH_ENDING");

    //-- calc scores by tuple: [playeridx, score]
    const scores = new Map<number, number>();
    for (let idx = 0; idx < match.players.length; idx++) {
      const bank = match.state.banks[idx];
      let score = 0;
      for (let [key, value] of bank.piles.entries()) {
        const maxValue = value.max();
        console.log("SCORED:", idx, "in:", key, "max:", maxValue);
        score += maxValue;
      }
      scores.set(idx, score);
    }

    //-- sort by id
    var scoresDesc = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    console.log("MATCH_ENDED:", JSON.stringify(scoresDesc));

    //-- handle tie situation on first and second place
    const winner = scoresDesc[0][1] !== scoresDesc[1][1] ? match.players[scoresDesc[0][0]] : null;
    const scoresFlat: Array<number> = Array.from(scores.values()).map(
      (entry) => entry
    ) as Array<number>;
    let event = new model.MatchEvent(model.OMatchEventType.MatchEnded, {
      matchEndedWinner: winner,
      matchEndedScores: scoresFlat,
    });
    {
      const state = Coordinator.addEvent(move, event, match.state);
      state.currentPlayerIndex = null;
    }
  }

  /**
   * Turns ending event
   * @param match selected match
   * @param move selected move
   * @param isSuccessful whether busted or not
   */
  private static turnEnding(match: model.Match, move: model.Move, isSuccessful: boolean): void {
    console.log("TURN_ENDING", isSuccessful);

    let cardsCollected: Array<model.Card> = [];
    {
      //-- identify collected cards index
      const startingstate = match.state;
      const playArea = startingstate.playArea;
      const collectIndex = isSuccessful
        ? playArea.length
        : playArea.cards.findIndex((e) => e.suit === model.OCardSuit.Anchor);

      //-- process playarea cards
      for (let i = 0; i < playArea.length; i++) {
        const card = playArea.cards[i];
        if (i < collectIndex) {
          //-- add to collected card temp array
          cardsCollected.push(card);
        } else {
          //-- discard card
          Coordinator.discardCard(match, move, card);
          //TODO: incorrect, should add this to a new state, but new state is only created at the end - rework later
        }
      }
    }

    //-- identify and add bonus cards for Chest & Key combo, drawn from discard pile
    if (
      cardsCollected.find((c) => c.suit === model.OCardSuit.Chest) &&
      cardsCollected.find((c) => c.suit === model.OCardSuit.Key)
    ) {
      const bonusCardAmount = cardsCollected.length;
      console.log("BONUS: Key&Chest", bonusCardAmount);
      const bonusCards = Coordinator.drawCardsFromDiscardPile(match, move, bonusCardAmount);
      //TODO: incorrect, should add this to a new state, but new state is only created at the end - rework later
      bonusCards.forEach((card) => cardsCollected.push(card));
    }

    {
      //-- clear play area
      const state = match.state;
      const playArea = state.playArea;
      playArea.cards.length = 0; //(0, playArea.length);
      //TODO: incorrect, should add this to a new state, but new state is only created at the end - rework later
    }

    {
      //-- clear any effects
      match.state.clearPendingEffect(); //-- remove any pending todos //TOCHECK
      delete match.state.pendingKrakenCards; //-- clear pending kraken cards
      //TODO: incorrect, should add this to a new state, but new state is only created at the end - rework later
    }

    {
      //-- collect cards & add event with turn ended
      const bank = match.state.banks[match.state.currentPlayerIndex];
      cardsCollected.forEach((card) => {
        //-- add to player's bank
        Coordinator.addCardToBank(bank, card);
      });
      //TODO: incorrect, should add this to a new state, but new state is only created at the end - rework later

      /*const state = */ Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.TurnEnded, {
          turnEndedIsSuccessful: isSuccessful,
          turnEndedCardsCollected: cardsCollected,
        }),
        match.state
      );
      console.log("TURN_ENDED:", JSON.stringify(cardsCollected), !isSuccessful ? "BUSTED!" : "");
    }

    //-- check if there are any drawpile left and move to next player
    if (match.state.drawPile.length > 0) {
      const nextPlayerIndex = (match.state.currentPlayerIndex + 1) % match.numberOfPlayers;
      Coordinator.turnStarting(match, move, nextPlayerIndex);
    } else {
      Coordinator.matchEnding(match, move);
    }
  }

  /**
   * Adds card to bank
   * @param bank selected bank
   * @param card selected card
   */
  private static addCardToBank(bank: model.Bank, card: model.Card) {
    if (!bank.piles.has(card.suit)) bank.piles.set(card.suit, new model.CardSuitStack());
    bank.piles.get(card.suit).add(card.value);
    console.log("COLLECT:", card);
  }

  /**
   * Turns starting event
   * @param match selected match
   * @param move selected move
   * @param playerIndex selected player
   */
  private static turnStarting(match: model.Match, move: model.Move, playerIndex: number): void {
    //-- move to the next player
    {
      const state = Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.TurnStarted, {
          turnStartedPlayer: match.players[playerIndex],
        }),
        match.state
      );
      state.currentPlayerIndex = playerIndex;
    }
    console.log(
      "TURN_START:",
      match.state.currentPlayerIndex,
      JSON.stringify(match.players?.at(match.state.currentPlayerIndex))
    );
  }

  /**
   * execute user action to respond to a card effect
   * @param match selected match
   * @param response input response
   * @param pendingEffect pending effect
   * @returns promise void
   */
  private static async actionRespondToEffect(
    match: model.Match,
    response: model.CardEffectResponse,
    pendingEffect: model.CardEffect
  ): Promise<void> {
    let responseCard = response.card ? new model.Card().populate(response.card) : null; //TODO: CHECK: some validation on card input
    console.log(">RESPOND_CARDEFFECT:", response.effectType, ":=", responseCard);
    if (!pendingEffect) throw new Error("No pending effects to respond to");
    //TODO: for some reaons on map return (match.state.pendingEffect.cards[0]) is not a number but a wrapper, no matter I switch it off
    //https://github.com/awslabs/dynamodb-data-mapper-js/tree/c504011dcc963c6b2046f0c2d6da0f52f3e92432/packages/dynamodb-auto-marshaller

    const move = (match.move = Coordinator.newMove(match));

    //================================================================
    if (response.effectType === model.OCardEffectType.Oracle) {
      //-- User Responded Effect - Oracle
      let nextCardPeeked = match.state.drawPile.nextCard; //-- remember card as we will delete before checking
      if (!nextCardPeeked) throw new Error("Oracle response without next card.");
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard, //-- shall be either a card or undefined - shall not be null, will cause unmarshall error
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - delete
      }

      if (!responseCard) {
        //-- card not picked - NO FURTHER ACTION NEEDED
      } else {
        //-- check if card is valid - same or null when placed back
        if (
          responseCard.suit != nextCardPeeked?.suit ||
          responseCard.value != nextCardPeeked?.value
        ) {
          //await Coordinator.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow

          throw new Error(
            "Inappropriate Card specified for effect response. Oracle peeked card was: " +
              JSON.stringify(nextCardPeeked) +
              "."
          );
        }

        //-- place the card
        let cardFromOracle = Coordinator.drawCard(match, move, true);
        Coordinator.placeCard(match, move, cardFromOracle);
      }
    }
    //================================================================
    else if (response.effectType === model.OCardEffectType.Hook) {
      if (!responseCard) throw new Error("Effect response must contain a card.");

      //-- User Responded Effect - Hook
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard,
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - delete
      }

      const bank = match.state.banks[match.state.currentPlayerIndex];
      const suitstack = bank.piles.get(responseCard?.suit);
      //-- check if card is valid == i.e. responded to AND exists in Bank AND is topmost on the stack
      if (suitstack?.max() != responseCard?.value) {
        //await Coordinator.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new Error("Card does not exist in Own Bank or is not the topmost one.");
      }

      //-- remove card from bank
      suitstack?.delete(responseCard?.value);
      if (suitstack?.size == 0) bank.piles.delete(responseCard?.suit);

      //-- place to playarea
      const cardFrombank = new model.Card(responseCard.suit, responseCard.value);
      Coordinator.placeCard(match, move, cardFrombank);
    }
    //================================================================
    else if (
      response.effectType === model.OCardEffectType.Cannon ||
      response.effectType === model.OCardEffectType.Sword
    ) {
      //-- User Responded Effect - Cannon, Sword
      if (!responseCard) throw new Error("Effect response must contain a card.");

      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard,
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - delete
      }

      const bankTargetIndex = match.state.banks.findIndex((bank, bankIndex) => {
        if (bankIndex == match.state.currentPlayerIndex) return false;
        const suitstack = bank.piles.get(responseCard?.suit);
        if (suitstack?.max() != responseCard?.value) return false;
        return true;
      });

      //-- check if card is valid == i.e. responded to AND exists in Bank AND is topmost on the stack
      if (bankTargetIndex < 0)
        throw new Error("Card does not exist in Enemy Bank(s) or is not the topmost one.");
      //-- Sword: check if card is valid -- we cannot have this suit
      if (response.effectType === model.OCardEffectType.Sword) {
        if (match.state.banks[match.state.currentPlayerIndex].piles.has(responseCard.suit))
          throw new Error("Sword: Player cannot pick a suit that owned already in bank.");
      }

      //-- remove card from bank
      const cardFrombank = responseCard; //new model.Card(responseCard.suit, responseCard.value);
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.CardRemovedFromBank, {
            cardRemovedFromBankCard: cardFrombank,
            cardRemovedFromBankIndex: bankTargetIndex,
          }),
          match.state
        );
        console.log("REMOVE_CARD_FROM_BANK:", cardFrombank, "player:", bankTargetIndex);

        const bankTarget = match.state.banks.at(bankTargetIndex);
        const suitstack = bankTarget.piles.get(responseCard?.suit);
        suitstack.delete(responseCard?.value);
        if (suitstack.size == 0) bankTarget.piles.delete(responseCard?.suit);
      }

      if (response.effectType === model.OCardEffectType.Cannon) {
        //-- place to DiscardPile
        Coordinator.discardCard(match, move, cardFrombank);
      } else if (response.effectType === model.OCardEffectType.Sword) {
        //-- place to playarea
        Coordinator.placeCard(match, move, cardFrombank);
      }
    }
    //================================================================
    else if (response.effectType === model.OCardEffectType.Map) {
      if (!responseCard) throw new Error("Effect response must contain a card.");

      //-- User Responded Effect - Map
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard,
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - delete
      }

      //-- check if selected card is within the possible cards
      const pendingEffectCards = pendingEffect?.cards;
      if (
        !responseCard ||
        !pendingEffectCards?.find(
          (c) => responseCard.suit == c.suit && responseCard.value == c.value
        )
      ) {
        //await Coordinator.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new Error("Inappropriate Card specified for effect response");
      }

      //-- place selected card to playarea AND play others back to discard
      pendingEffectCards?.forEach((c) => {
        if (responseCard.suit == c.suit && responseCard.value == c.value) {
          //-- add to playarea
          Coordinator.placeCard(match, move, c);
        } else {
          //-- add back to discard
          //-- place back unchosen cards to discardPile -- it is OK not add a new state, modify ResponseToEffect state
          Coordinator.discardCard(match, move, c);
        }
      });
    }
  }
}
