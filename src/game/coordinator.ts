import "core-js/es/array/at";
import cloneDeep from "lodash/cloneDeep";
//import cloneDeepWith from "lodash/cloneDeepWith";

import Registry from "./registry";
import * as model from "./model/model";
import * as utils from "../utils";

//TODO: Kraken->Cannon->Oracle //BUG: not working yet

export default class Coordinator {
  private static _instance: Coordinator;
  public static get Instance(): Coordinator {
    return this._instance || (this._instance = new this());
  }

  private static newMove(match: model.Match): model.Move {
    //-- copy state over frm previous move state to keep continuity
    //-- no need to clone state, we can easily sacrifice the state of the previous move as it wa salready persisted
    const move = new model.Move(match.id, match.move?.state);
    move.sequenceId = match.move ? match.move?.sequenceId + 1 : 0;
    return move;
  }
  private static persistMove(move: model.Move) {
    Registry.Instance.putMovePromise(move);
  }

  private static addEvent(
    move: model.Move,
    event: model.MatchEvent,
    oldState: model.MatchState
  ): model.MatchState {
    //-- copy state to new state
    const state = model.MatchState.clone(oldState);
    event.state = state;

    move.addEvent(event);
    return state;
  }

  public async actionStartMatch(
    players: model.PlayerId[],
    initialDrawPile?: Array<any>
  ): Promise<model.Match> {
    console.log(">START_MATCH", players);

    //-- check if all players exists and there is exactly 2 players
    const playerdata = await Promise.all(
      players.map(async (pid) => await Registry.Instance.getPlayerByIdPromise(pid))
    ); //TODO: improve Registy to query all id's at once
    if (players.length != 2 || playerdata.some((pd) => !pd))
      throw new Error("Invalid players specified, please check settings.");

    let match = new model.Match(playerdata);

    await Registry.Instance.putMatchPromise(match); //match.persist():
    console.log("MATCH_STARTS:", match.id);

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
      startingState.discardPile = new model.CardPile();
      startingState.drawPile = model.DrawCardPile.create(initialDrawPile);
      //  model.DrawCardPile.create(["Anchor", "Mermaid"], [2, 3]);
      //  model.DrawCardPile.generate(null, [2, 3, 4]);
      //  model.DrawCardPile.create([
      //   ["Mermaid", 2],
      //   ["Anchor", 2],
      //   ["Mermaid", 3],
      // ]);
      //  model.DrawCardPile.create(Object.keys(model.OCardSuit) as model.CardSuit[],[2,3]);
      //  model.DrawCardPile.create();
    }

    //-- announce turn starting
    this.turnStarting(match, move, match.state.currentPlayerIndex);

    //-- return event
    Coordinator.persistMove(match.move);
    return match;
  }

  public async executeActionPromise(
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
      await this.actionDraw(match);
    } else if (data.etype == "EndTurn") {
      await this.actionEndTurn(match);
    } else if (data.etype == "ResponseToEffect") {
      await this.actionRespondToEffect(match, data.effect, pendingEffect);
    } else {
      throw new Error("Unknown action verb: " + data.etype);
    }

    //-- return generated events
    Coordinator.persistMove(match.move);
    return match.move?.getEvents();
  }

  private async actionEndTurn(match: model.Match): Promise<void> {
    console.log(">ENDTURN");

    //-- CHECK: are there any cards on the play area
    const state = match.state;
    if (state.playArea.length == 0) throw new Error("Cannot end turn with empty playarea.");

    //-- add initiator
    const move = (match.move = Coordinator.newMove(match));

    Coordinator.addEvent(move, new model.MatchEvent(model.OMatchEventType.EndTurn), state);

    //-- initiate forced turn end
    this.turnEnding(match, move, true);
  }

  private drawCard(
    match: model.Match,
    move: model.Move,
    doRemoveFromPile: boolean = true
  ): model.Card {
    const state = match.state;

    //-- if drawpile is exhausted - annotation match end
    if (state.drawPile.length == 0) {
      //-- do a standard tun ending and collection, this will trigger the match end
      //-- Warning: this could result in endless stack, when drawPile is empty + one gets bonus cards -> extra conditional at bonus assignment
      this.turnEnding(match, move, true);
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

  private placeCard(match: model.Match, move: model.Move, card: model.Card): model.Card {
    //== place card to playarea
    //-- check for busted
    const isSuccessful = match.state.playArea.cards.find((c) => c.suit == card.suit) == null;
    if (!isSuccessful) {
      //-- busted
      console.log(
        "PLACE_CARD:",
        card,
        "area:",
        JSON.stringify(match.state.playArea, utils.fnSetMapSerializer),
        "BUSTED!"
      );
      this.discardCard(match, move, card);
      this.turnEnding(match, move, isSuccessful);
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

      console.log(
        "PLACE_CARD:",
        card,
        "area:",
        JSON.stringify(state.playArea, utils.fnSetMapSerializer)
      );
    }

    //-- execute effects based on Suit special
    if (card.suit === model.OCardSuit.Kraken) {
      for (let i = 0; i < 2; i++) {
        const cardDrawnKraken = this.drawCard(match, move);
        if (!cardDrawnKraken) break;

        //-- clear pending effect (can only be oracle) - Kraken ignores that
        if (match.pendingEffect?.effectType == model.OCardEffectType.Oracle)
          match.state.clearPendingEffect();
        else if (match.pendingEffect) {
          throw new Error(
            "Game inconsistency - Kraken with some other pending effect" +
              JSON.stringify(match.pendingEffect)
          );
        }

        console.log("CARDEFFECT:", card.suit, ":", cardDrawnKraken);
        const cardPlacedKraken = this.placeCard(match, move, cardDrawnKraken);

        //-- You will draw two cards from the Draw Pile, unless the first card drawn is a Hook, Sword or Map.
        //-- Any of those three Suit Abilities adds an additional card to the Play Area.
        //-- or if is busted (null)
        if (
          !cardPlacedKraken ||
          cardPlacedKraken?.suit in
            [model.OCardSuit.Hook, model.OCardSuit.Map, model.OCardSuit.Sword]
        )
          break;

        //-- if busted (thus ended) in the meantime, break
        if (move.lastEvent.eventType === "TurnStarted") break;
      }
    } else if (card.suit === model.OCardSuit.Oracle) {
      //-- if drawpile is empty, just skip
      if (match.state.drawPile.length > 0) {
        const cardPeekedOracle = this.drawCard(match, move, false);
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
        console.log("CARDEFFECT:", card.suit, ":", "ignored - due to empty drawpile");
      }
    } else if (card.suit === model.OCardSuit.Hook) {
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
    } else if (card.suit === model.OCardSuit.Cannon || card.suit === model.OCardSuit.Sword) {
      //-- if no other player bank has elements, just skip
      const anyItemsInAnyBanks = !!match.state.banks.find(
        (bank, bindex) => bindex != match.state.currentPlayerIndex && bank.flatSize > 0
      );
      if (anyItemsInAnyBanks) {
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
        console.log("CARDEFFECT:", card.suit, ":", "ignored - due to empty enemy banks");
      }
    } else if (card.suit === model.OCardSuit.Map) {
      //-- if draw pile has no elements, just skip
      if (match.state.discardPile.length > 0) {
        let cardsFromDiscard = new Array<model.Card>();
        for (let i = 0; i < 3; i++) {
          if (!match.state.discardPile.length) break;

          let idx = Math.floor(Math.random() * match.state.discardPile.length);
          let card = match.state.discardPile.cards[idx];

          //-- remove from discard, add to effect card list
          cardsFromDiscard.push(card);
          match.state.discardPile.cards.splice(idx, 1);
        }

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
            JSON.stringify(cardsFromDiscard, utils.fnSetMapSerializer),
            "[requires user response]"
          );
        }
      } else {
        console.log("CARDEFFECT:", card.suit, ":", "ignored - due to empty discardpile");
      }
    }

    return card;
  }

  private discardCard(match: model.Match, move: model.Move, card: model.Card): void {
    console.log("DISCARD:", card);
    move.state.discardPile.cards.push(card);
  }

  private async actionDraw(match: model.Match): Promise<void> {
    console.log(">DRAW");
    const move = (match.move = Coordinator.newMove(match));

    const card = this.drawCard(match, move);
    if (card) this.placeCard(match, move, card);
  }

  public async matchEnding(match: model.Match, move: model.Move): Promise<void> {
    console.log("MATCH_ENDING");

    //-- calc scores
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
    console.log("MATCH_ENDED:", JSON.stringify(scoresDesc, utils.fnSetMapSerializer));

    const winner = scoresDesc[0][0] !== scoresDesc[1][0] ? match.players[scoresDesc[0][0]] : null; //-- handle tie situation
    const scoresFlat = Array.from(scores.values());
    let event = new model.MatchEvent(model.OMatchEventType.MatchEnded, {
      matchEndedWinner: winner,
      matchEndedScores: scoresFlat,
    });
    {
      const state = Coordinator.addEvent(move, event, match.state);
      state.banks.forEach((bank) => bank.piles.clear());
      state.currentPlayerIndex = -1;
    }
  }

  private turnEnding(match: model.Match, move: model.Move, isSuccessful: boolean) {
    console.log("TURN_ENDING", isSuccessful);
    match.state.clearPendingEffect(); //-- remove any pending todos //TOCHECK

    let cardsCollected: Array<model.Card> = [];
    {
      //-- identify collected cards index
      const state = match.state;
      const playArea = state.playArea;
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
          this.discardCard(match, move, card);
        }
      }
    }

    //-- identify and add bonus cards for Chest & Key combo
    if (
      cardsCollected.find((c) => c.suit === model.OCardSuit.Chest) &&
      cardsCollected.find((c) => c.suit === model.OCardSuit.Key)
    ) {
      const bonusCardAmount = cardsCollected.length;
      console.log("BONUS: Key&Chest", bonusCardAmount);
      for (let i = 0; i < bonusCardAmount; i++) {
        if (match.state.drawPile.length == 0) break; //-- to avoid endless call stack loop
        const bonusCard = this.drawCard(match, move, true);
        if (bonusCard) cardsCollected.push(bonusCard);
      }
    }

    {
      //-- clear play area
      const state = match.state;
      const playArea = state.playArea;
      playArea.cards.length = 0; //(0, playArea.length);
    }

    {
      //-- collect cards & add event with turn ended
      const bank = match.state.banks[match.state.currentPlayerIndex];
      cardsCollected.forEach((card) => {
        //-- add to player's bank
        this.addCardToBank(bank, card);
      });

      /*const state = */ Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.TurnEnded, {
          turnEndedIsSuccessful: isSuccessful,
          turnEndedCardsCollected: cardsCollected,
        }),
        match.state
      );
      console.log(
        "TURN_ENDED:",
        JSON.stringify(cardsCollected, utils.fnSetMapSerializer),
        !isSuccessful ? "BUSTED!" : ""
      );
    }

    //-- check if cards are out or move to the next player
    if (match.state.drawPile.length > 0) {
      const state = match.state;
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % match.numberOfPlayers;
      this.turnStarting(match, move, nextPlayerIndex);
    } else {
      this.matchEnding(match, move);
    }
  }

  private addCardToBank(bank: model.Bank, card: model.Card) {
    if (!bank.piles.has(card.suit)) bank.piles.set(card.suit, new model.CardSuitStack());
    bank.piles.get(card.suit).stack.add(card.value);
    console.log("COLLECT:", card);
  }

  private turnStarting(match: model.Match, move: model.Move, playerIndex: number) {
    //-- move to the next player
    {
      const state = Coordinator.addEvent(
        move,
        new model.MatchEvent(model.OMatchEventType.TurnStarted, {
          turnStartedPlayer: match.players[playerIndex].id,
        }),
        match.state
      );
      state.currentPlayerIndex = playerIndex;
    }
    console.log("TURN_START:", match.state.currentPlayerIndex);
  }

  private async actionRespondToEffect(
    match: model.Match,
    response: model.CardEffectResponse,
    pendingEffect: model.CardEffect
  ): Promise<void> {
    console.log(">RESPOND_CARDEFFECT:", response.effectType, ":=", response.card);
    if (!pendingEffect) throw new Error("No pending effects to respond to");

    const move = (match.move = Coordinator.newMove(match));
    let responseCard = response.card
      ? new model.Card(response.card.suit as model.CardSuit, response.card.value as model.CardValue)
      : undefined; //CHECK: some validation on card input

    //================================================================
    if (response.effectType === model.OCardEffectType.Oracle) {
      //-- User Responded Effect - Oracle
      let nextCardPeeked = match.state.drawPile.nextCard; //-- remember card as we will delete before checking
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard, //-- shall be either a card or undefined - shall not be null, will cause unmarshall error
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - set to null
      }

      if (response.card == null) {
        //-- card not picked - NO FURTHER ACTION NEEDED
      } else {
        //-- check if card is valid - same or null when placed back
        if (
          response.card.suit != nextCardPeeked?.suit ||
          response.card.value != nextCardPeeked?.value
        ) {
          //await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow

          throw new Error(
            "Inappropriate Card specified for effect response. Oracle card is: " +
              JSON.stringify(nextCardPeeked) +
              "."
          );
        }

        //-- place the card
        let cardFromOracle = this.drawCard(match, move, true);
        this.placeCard(match, move, cardFromOracle);
      }
    }
    //================================================================
    else if (response.effectType === model.OCardEffectType.Hook) {
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
        state.clearPendingEffect(); //-- process pending effect - set to null
      }

      const bank = match.state.banks[match.state.currentPlayerIndex];
      const suitstack = bank.piles.get(responseCard?.suit);
      //-- check if card is valid == i.e. responded to AND exists in Bank AND is topmost on the stack
      if (suitstack?.max() != response.card?.value) {
        //await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new Error("Card does not exist in Own Bank or is not the topmost one.");
      }

      //-- remove card from bank
      suitstack.stack.delete(responseCard?.value);
      if (suitstack.stack.size == 0) bank.piles.delete(responseCard?.suit);

      //-- place to playarea
      const cardFrombank = new model.Card(responseCard.suit, responseCard.value);
      this.placeCard(match, move, cardFrombank);
    }
    //================================================================
    else if (
      response.effectType === model.OCardEffectType.Cannon ||
      response.effectType === model.OCardEffectType.Sword
    ) {
      //-- User Responded Effect - Cannon, Sword
      {
        const state = Coordinator.addEvent(
          move,
          new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
            responseToEffectType: response.effectType,
            responseToEffectCard: responseCard,
          }),
          match.state
        );
        state.clearPendingEffect(); //-- process pending effect - set to null
      }

      const bankTargetIndex = match.state.banks.findIndex((bank, bankIndex) => {
        if (bankIndex == match.state.currentPlayerIndex) return false;
        const suitstack = bank.piles.get(responseCard?.suit);
        if (suitstack?.max() != response.card?.value) return false;
        return true;
      });
      const bankTarget = match.state.banks.at(bankTargetIndex);
      //-- check if card is valid == i.e. responded to AND exists in Bank AND is topmost on the stack
      if (!bankTarget) {
        //await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new Error("Card does not exist in Enemy Bank(s) or is not the topmost one.");
      }

      //-- remove card from bank
      const cardFrombank = responseCard; //new model.Card(response.card.suit, response.card.value);
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

        const suitstack = bankTarget.piles.get(responseCard?.suit);
        suitstack.stack.delete(responseCard?.value);
        if (suitstack.stack.size == 0) bankTarget.piles.delete(responseCard?.suit);
      }

      if (response.effectType === model.OCardEffectType.Cannon) {
        //-- place to DiscardPile
        this.discardCard(match, move, cardFrombank);
      } else if (response.effectType === model.OCardEffectType.Sword) {
        //-- place to playarea
        this.placeCard(match, move, cardFrombank);
      }
    }
    //================================================================
    else if (response.effectType === model.OCardEffectType.Map) {
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
        state.clearPendingEffect(); //-- process pending effect - set to null
      }

      //-- check if selected card is within the possible cards
      const pendingEffectCards = pendingEffect?.cards;
      if (
        !response.card ||
        !pendingEffectCards?.find(
          (c) => response.card.suit == c.suit && response.card.value == c.value
        )
      ) {
        //await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new Error("Inappropriate Card specified for effect response");
      }

      //-- play others back to discard, place selected card to playarea

      pendingEffectCards?.forEach((c) => {
        if (response.card.suit == c.suit && response.card.value == c.value) {
          //-- add to playarea
          this.placeCard(match, move, c);
        } else {
          //-- add back to discard
          this.discardCard(match, move, c);
        }
      });
    }
  }

  // private async redoCurrentMovePromise(match: model.Match) {
  //   //match.moves.splice(match.moves.length - 1, 1); //-- remove this move as it is invalid
  //   match.move = await Registry.Instance.getLastMoveByMatchIdPromise(match.id);
  // }

  public generateDrawPile(drawPile: model.DrawCardPile) {
    let s: keyof typeof model.OCardSuit;
    for (s in model.OCardSuit) {
      let cv: model.CardValue;
      for (cv = 2; cv <= 3; cv++) {
        const card = new model.Card(s, cv as model.CardValue);
        drawPile.cards.push(card);
      }
    }

    // let s: keyof typeof model.OSuit;
    // for (s in model.OSuit) {
    //   let cv: model.CardValue;
    //   for (cv = 2; cv <= 7; cv++) {
    //     const card = new model.Card(s, cv as model.CardValue);
    //     state.drawPile.push(card);
    //   }
    // }
    // let k: keyof typeof model.OSuit;
    // for (k in model.OSuit) {
    //   const s = model.OSuit[k];
    //   let cv: model.CardValue;
    //   for (cv = 2; cv <= 7; cv++) {
    //     const card = new model.Card(s, cv as model.CardValue);
    //     state.drawPile.push(card);
    //   }
    // }
    // for (let suit: keyof model.OSuit in model.OSuit) {
    //   const xx = model.OSuit[suit];
    //   state.drawPile.set(model.OSuit.Anchor, new Set<number>([2, 3, 4, 5, 6, 7]));
    //   for (let value = 2; value <= 7; value++) {}
    // }
  }
}
