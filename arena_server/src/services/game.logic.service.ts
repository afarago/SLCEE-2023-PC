import 'core-js/es/array/at';

import assert from 'node:assert/strict';
import { Container, Inject } from 'typedi';
import * as util from 'util';

import Logger from '../config/logger';
import { GameError } from '../dto/utils';
import MatchCreationParams from '../models/game/matchcreationparams';
import { IStateDelta } from '../models/game/matchevent';
import * as model from '../models/game/model';
import State from '../models/game/state';
import UserAction, { IsMatchActionType, OMatchActionType } from '../models/game/useraction';
import RandomGenerator from '../utils/random';
import DBAService from './dba.service';

// -- number of turn skippping timeout before match is terminated
const MAX_TIMEOUT_TURNEND = Number(process.env.MAX_TIMEOUT_TURNEND) || 10;

/**
 * GameController class, main game controller
 */
export default class GameLogicService {
  constructor(private match: model.Match | null, private username: string, private clientip: string) {}

  @Inject()
  private dbaService: DBAService = Container.get(DBAService);

  private _randomGenerator: RandomGenerator;
  private get randomGenerator() {
    if (!this._randomGenerator) this._randomGenerator = new RandomGenerator(this.match?.creationParams?.randomSeed);
    return this._randomGenerator;
  }

  private log(message: string): void {
    Logger.info(`[${this.match?._id}:${this.username}] ${message}`);
  }
  private logDebug(message: string): void {
    Logger.debug(`[${this.match?._id}:${this.username}] ${message}`);
  }

  /**
   * Creates a Move object on the global match
   * @param match
   * @returns move
   */
  private newMove(): model.Move {
    assert(this.match);
    if (!this.match.state) this.match.stateCache = new model.State();

    // -- copy state over from previous move state to keep continuity
    assert(this.match.state);
    const move = new model.Move(this.match._id, State.clone(this.match.state));
    move.clientIP = this.clientip;
    move.sequenceId = Number.isFinite(this.match.moveCount) ? this.match.moveCount : 0;
    this.match.moveCountInTurn =
      this.match.moveCountInTurn !== null && Number.isFinite(this.match.moveCountInTurn)
        ? this.match.moveCountInTurn + 1
        : 1;
    move.sequenceInTurnId = this.match.moveCountInTurn;
    move.turnId = this.match.turnCount;
    return move;
  }

  /**
   * Persists move and match
   */
  private async persistMoveAndMatchPromise(isNewMatch: boolean = false) {
    assert(this.match && this.match.move && this.match.state);

    const originalMoveAt = this.match.lastMoveAt; // -- this will be the checkpoint to guard potential concurrent writes

    this.match.moveCount = this.match.move.sequenceId + 1;
    this.match.lastMoveAt = this.match.move.at = new Date();

    // -- this is to persist the player in the header as well, might be null after matchEnd
    const currentPlayerIndex = this.match.state.currentPlayerIndex;
    this.match.currentPlayerIndex = currentPlayerIndex;
    this.match.activePlayerIdCached = this.match.getActivePlayerId();
    this.match.stateCache = this.match.move?.state;

    // -- persist in db
    await this.dbaService.upsertMatchAndCreateMovePromise(this.match, this.match.move, originalMoveAt, isNewMatch);
  }

  /**
   * Adds event to the Match/Move
   * @param event
   * @param oldState
   * @returns event added event
   */
  private addEvent(event: model.MatchEvent, oldState: model.State): model.State {
    assert(this.match);
    assert(this.match.move);

    // -- copy state to new state
    const state = model.State.clone(oldState);
    event.state = state;

    this.match.move.addEvent(event);
    return state;
  }

  /**
   * Responds to user action to start a match
   * @param createdByPlayerId player who create the match - valid player_id or null for admin
   * @param creationParams match creation params
   * @returns started match parameters
   */
  public async actionStartMatchPromise(
    createdByPlayerId: model.PlayerId | null,
    params: MatchCreationParams
  ): Promise<model.Match> {
    if (!params.playerids) throw new Error('Need playerids to start a match');

    this.logDebug(`>START_MATCH`);

    // -- create initial objects from user input, early checking of input data
    // -- when not set, but generated, remove "0." from the start - write it back so it will be saved as well
    const randomSeed = params.randomSeed ?? (params.randomSeed = Math.random().toString().slice(2));
    this.randomGenerator.initRandom(randomSeed);
    const playerData = await this.dbaService.getPlayerByIdsPromise(params.playerids);
    // -- guard: check if all players exists and there is exactly 2 players
    if (playerData.length !== 2 || playerData.some((pd) => !pd))
      throw new GameError('Invalid players specified, please check settings.');
    const initialPlayArea = model.PlayArea.create(params?.playArea);
    const initialDiscardPile = model.DiscardPile.create(params?.discardPile);
    const initialDrawPile = model.DrawCardPile.create(params?.drawPile, this.randomGenerator);
    const initialBanks = Array(playerData.length)
      .fill(null)
      .map((val, idx): model.Bank => {
        // -- warning: input format is [[Card]] --> [ [Bank1Card1,Bank1Card2], [Bank2Card1,Bank2Card2] ]
        const value = params?.banks?.[idx];
        const pile = model.CardPile.constructFromObject(value);
        const bank = model.Bank.fromCardPile(pile, new model.Bank()) as model.Bank;
        return bank;
      });

    // -- check initial debug settings are OK - merge all cards and check for duplicates
    if (params.discardPile || params.drawPile || params.banks) {
      const allCards: model.Card[] = [
        ...initialPlayArea.cards,
        ...initialDiscardPile.cards,
        ...initialDrawPile.cards,
        ...initialBanks.flatMap((bank) => bank.toCardPile().cards),
      ];
      allCards.forEach((item, index, arr) => {
        if (arr.findIndex((item2) => item2.equals(item)) !== index)
          throw new GameError(`Duplicate cards not allowed '${Object.values(item)}'`);
      });
    }

    // ===============================================================
    // -- everything seems to be OK - create the match
    this.match = new model.Match(
      createdByPlayerId,
      playerData?.map((player) => player._id),
      MatchCreationParams.constructFromObject(params)
    );
    this.match.turnCount = 1;

    // -- randomize starting player
    const startingPlayerIndex = Math.floor(this.randomGenerator.getRandom(this.match.numberOfPlayers));

    // -- create initial state and initial move
    this.match.move = this.newMove();
    {
      // -- announce match starting
      assert(this.match.state);
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.MatchStarted, {
          matchStartedSeed: randomSeed,
        }),
        this.match.state
      );

      this.match.state.banks = initialBanks;
      this.match.state.playArea = initialPlayArea;
      this.match.state.discardPile = initialDiscardPile;
      this.match.state.drawPile = initialDrawPile;
    }

    // -- announce turn starting and record initial state
    this.turnStarting(startingPlayerIndex);
    // match.stateAtTurnStart = match.state;
    this.match.moveCountInTurn = 1;

    // -- persist to db
    await this.persistMoveAndMatchPromise(true);
    this.log(`MATCH_STARTED: ${this.match._id.toString()} ${params.playerids} ${params.tags ?? ''}`);

    // -- return result
    return this.match;
  }

  /**
   * Actions delete match promise
   * Forceful deletion of a match by Admins, e.g. when timeout
   * @param id game id
   * @param winnerId winning player Id
   * @param [comment] termination comment
   */
  public async actionDeleteMatchPromise(winnerId?: model.PlayerId | null, comment?: string): Promise<model.Move> {
    assert(this.match);

    // -- Guard: check not finished match
    if (this.match.isFinished) throw new GameError('No action possible on finished matches.');

    let winnerIdx: number | null | undefined;
    if (winnerId !== undefined) {
      // -- if winner id is explicitely stated
      if (winnerId !== null) {
        // -- determine winner idx from id
        winnerIdx = this.match.playerids.findIndex((pobj) => pobj.toString() === winnerId.toString());
        if (winnerIdx < 0) winnerIdx = null;
      } else {
        winnerIdx = null; //-- tie
      }
    } else {
      // -- if winner id is not explicitely stated - winner will be calculated based on the default logic - more points will win, or tie on equality
      winnerIdx = undefined; //-- calculate

      // -- set comment
      const elapsedSec = (Date.now() - this.match.lastMoveAt.getTime()) / 1000;
      comment = `Forceful termination due to player ${this.match.getActivePlayerId()} inactivity after ${elapsedSec} seconds.`;
    }
    this.log(`Terminate ${comment}`);

    // -- new move
    this.match.move = this.newMove();
    await this.matchEnding(true, winnerIdx, comment);

    // -- persist to db
    await this.persistMoveAndMatchPromise();

    // -- return move
    return this.match.move;
  }

  /**
   * Check if match needs to be tarminated due to timeout
   * @returns true if termination happened
   */
  public async checkTimeoutAndAutoTerminatePromise(): Promise<model.Move | undefined> {
    assert(this.match);
    assert(this.match.state);

    const timeout = this.match.creationParams?.timeout;
    if (timeout) {
      const elapsedSec = (Date.now() - this.match.lastMoveAt.getTime()) / 1000;
      if (elapsedSec > timeout) {
        if ((this.match.state.timeoutCount ?? 0) < MAX_TIMEOUT_TURNEND) {
          // -- forceful end turn
          // -- TurnStart: check if this is a new turn and increment
          if (!this.match.moveCountInTurn) this.newTurn();

          // -- add initiator move
          if (!this.match.move) this.match.move = this.newMove();

          // -- add comment event
          {
            const comment = `Forceful turn ending due to player ${this.match.getActivePlayerId()} inactivity after ${elapsedSec} seconds.`;
            this.addEvent(new model.MatchEvent(model.OMatchEventType.Comment, { comment }), this.match.state);
            this.match.state.timeoutCount = (this.match.state.timeoutCount ?? 0) + 1;
          }

          // -- autopick processing any pending effects
          this.guardPendingEffect(new UserAction(OMatchActionType.EndTurn, undefined, true));

          // -- force ending even with emply playarea, handle match ending if needed
          await this.subactionEndTurnPromise(true);

          // -- persist changes
          await this.persistMoveAndMatchPromise();

          return this.match.move;
        } else {
          // -- forceful end match
          const move = await this.actionDeleteMatchPromise(undefined, undefined);
          return move;
        }
      }
    }

    return undefined;
  }

  /**
   * responds to user actions
   * @param match
   * @param data
   * @returns promise to action
   */
  public async actionExecuteUserActionPromise(data: UserAction): Promise<model.Move> {
    assert(this.match);

    // -- Guard: check correct action verb
    if (!IsMatchActionType(data.etype)) throw new GameError(`Unknown action verb: ${data.etype}`);

    // -- Guard: check not finished match
    if (this.match.isFinished) throw new GameError('No action possible on finished matches.');

    // -- TurnStart: check if this is a new turn and increment
    if (!this.match.moveCountInTurn) this.newTurn();

    // -- Guard: timeout handling - if timeout happened move will be returned
    {
      const move = await this.checkTimeoutAndAutoTerminatePromise();
      if (move) return move;
    }

    // -- Guard: Pending effect - if there is a pending effect that accepts the current handling (guard invalid responses)
    const pendingEffect = this.guardPendingEffect(data);

    // -- carry out user action
    if (
      this.match.move?.state?.pendingEffect ||
      this.match.move?.events?.some((ev) => ev.eventType === model.OMatchEventType.TurnEnded)
    ) {
      // -- stop if something important happened during pre-execution (due to previous pending effect an silent autopick)
      this.logDebug(
        'Something important (turnEnded or new pending effect) changed, so we cannot move on with normal processing'
      );
    } else {
      // -- act according to the event type
      switch (data.etype) {
        case OMatchActionType.Draw:
          await this.subactionDrawPromise();
          break;

        case OMatchActionType.EndTurn:
          await this.subactionEndTurnPromise();
          break;

        case OMatchActionType.ResponseToEffect:
          if (
            !!data.autopick &&
            !pendingEffect &&
            this.match.move?.events.some((event) => event.eventType === model.OMatchEventType.ResponseToEffect)
          ) {
            this.logDebug('Skipping as autopicking has already processed the pending event'); // NOOP
          } else {
            assert(data.effect && pendingEffect);
            await this.subactionRespondToEffectPromise(data.effect, pendingEffect);
          }
          break;
      }
    }

    // -- check turn+match should be ended
    if (!this.match.isFinished && !this.match.move?.state?.drawPile?.length && !this.match.move?.state?.pendingEffect) {
      // -- do a standard tun ending and collection, this will trigger the match end
      this.turnEnding(true);
    }

    // -- persist to db
    assert(this.match.move);
    this.match.move.userAction = data;
    await this.persistMoveAndMatchPromise();

    return this.match.move;
  }

  /**
   * Start of a new turn, so make a delta and deliver it to the player
   */
  private newTurn() {
    assert(this.match && this.match.state);
    assert(this.match.state?.currentPlayerIndex !== null);

    // -- load last move, and the stateAtTurnStart
    // move = await this.dbaService.getLastMoveByMatchIdPromise(this.match._id);
    // if (!move) throw new GameError('Action on uninitialized match without initial move.');

    // -- increase turn count
    this.match.turnCount = Number.isFinite(this.match.turnCount) ? this.match.turnCount + 1 : 1;

    // -- create new move (first of the turn)
    this.match.move = this.newMove();

    // -- announce next player starting
    const nextPlayerIndex = (this.match.state.currentPlayerIndex + 1) % this.match.numberOfPlayers;
    this.turnStarting(nextPlayerIndex);
  }

  /**
   * Guards pending effect and autopicks if instructed
   * @param data
   * @returns pending effect (if available)
   */
  private guardPendingEffect(data: UserAction): model.CardEffect | undefined {
    assert(this.match);
    let pendingEffect = this.match.state?.pendingEffect;

    // -- Silently cancelling pending Effects due to (EndTurn or Draw) "AutoPicking"
    // -- Iterate as long as we face new ones and are able and allowed to process them
    while (
      pendingEffect &&
      // -- (kraken and oracle auto accepts draw with default action, yet only steps one action, processed as main action Draw)
      // --  autopick: all other suits need explicit autopick allowed to continue here
      data.autopick === true &&
      // -- has not yet hit endturn
      !this.match.move?.events?.some((ev) => ev.eventType === model.OMatchEventType.TurnEnded)
    ) {
      // -- process effects with empty choice without user roundtrip - "autopick" user input
      const autopickedResponse = new model.CardEffectResponse(pendingEffect.effectType, null);

      this.logDebug(
        `>AutoPicking the pending ${pendingEffect.effectType} effect in response to User action ${data.etype}`
      );
      this.respondToEffectLogic(autopickedResponse, pendingEffect, true);
      pendingEffect = this.match.state?.pendingEffect;
      // -- pending effect is already removed, and if none added, we will exit the loop
    }

    // -- check if there are any pending effects (we were not allowed or able to autoprocess)
    if (pendingEffect) {
      // -- check if correct response were given to challenge
      if (
        (data.etype === OMatchActionType.ResponseToEffect && pendingEffect?.effectType === data.effect?.effectType) ||
        (data.etype === OMatchActionType.Draw &&
          [model.OCardEffectType.Kraken, model.OCardEffectType.Oracle].includes(pendingEffect.effectType)) ||
        (data.etype === OMatchActionType.EndTurn && model.OCardEffectType.Oracle === pendingEffect.effectType)
      ) {
        // -- NOOP, we can proceed to after the guardEffect function
      } else {
        // -- does not look good, user should respond explicitely first
        throw new GameError(`Respond to pending effect first: ${pendingEffect.effectType}`);
      }
    }
    return pendingEffect;
  }

  /**
   * Picks card for sword or cannon
   * @param cardsuit
   * @returns card for sword or cannon
   */
  private pickCardForSwordOrCannon(cardsuit?: string): model.Card | null {
    assert(this.match && this.match.state && this.match.state?.currentPlayerIndex !== null);
    const currentBank = this.match.state.banks[this.match.state.currentPlayerIndex];
    assert(currentBank);

    let pickedCardForSwordOrCannon: model.Card | null = null;
    if (this.match.state?.banks) {
      for (const bank of this.match.state.banks) {
        if (bank === currentBank || bank.flatSize === 0) continue;
        for (const [s, cpack] of bank.piles) {
          // -- sword cannot pick from suitstack that exists in out bank
          if (cardsuit === model.OCardSuit.Sword && currentBank.piles.has(s)) continue;
          // -- return top of stack
          pickedCardForSwordOrCannon = new model.Card(s, cpack.max() as model.CardValue);
          break;
        }
      }
    }
    return pickedCardForSwordOrCannon;
  }

  /**
   * responds to user action to end a turn
   * @param match
   * @returns void promise
   */
  private async subactionEndTurnPromise(isForced: boolean = false): Promise<void> {
    assert(this.match && this.match.state);
    this.log('>ENDTURN');

    // -- CHECK: are there any cards on the play area
    if (!isForced) {
      const state = this.match.state;
      if (!state.playArea.length) throw new GameError('Cannot end turn with empty playarea.');
    }

    // -- add initiator move
    if (!this.match.move) this.match.move = this.newMove();

    // -- initiate forced turn end
    this.turnEnding(true);
  }

  /**
   * Draws a card from drawpile
   * @param [doRemoveFromPile] whether to remove item from the drawpile
   * @returns card drawn
   */
  private drawCard(doRemoveFromPile: boolean = true): model.Card | undefined {
    assert(this.match && this.match.state);

    // -- if drawpile is exhausted - annotation match end
    if (!this.match.state.drawPile?.length) {
      // -- do a standard turn ending and collection, this will trigger the match end
      this.turnEnding(true); // TODO: check - could be unnneded
      return undefined;
    }

    // -- execute the draw
    const cardDrawn = this.match.state.drawPile.draw(doRemoveFromPile);

    // -- event only - if removed
    if (doRemoveFromPile)
      this.addEvent(new model.MatchEvent(model.OMatchEventType.Draw, { drawCard: cardDrawn }), this.match.state);

    this.logDebug(`${doRemoveFromPile ? 'DRAW_CARD' : 'PEEK_CARD'}: '${util.inspect(cardDrawn)}'`);

    return cardDrawn;
  }

  /**
   * Places card to the playarea
   * @param card selected card
   * @returns card
   */
  private placeCard(card: model.Card): model.Card | undefined {
    assert(this.match && this.match.state);

    // == place card to playarea
    // -- check for busted
    const isSuccessful = !this.match.state.playArea.cards.find((c) => c.suit === card.suit);
    if (!isSuccessful) {
      // -- busted
      this.logDebug(`PLACE_CARD: '${util.inspect(card)}' area: '${util.inspect(this.match.state.playArea)}' BUSTED!`);
      this.discardCard(card);
      this.turnEnding(false); // -- clears all effects anyhow
      return undefined;
    }

    // -- add drawn card
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.CardPlacedToPlayArea, {
          cardPlacedToPlayAreaCard: card,
        }),
        this.match.state
      );
      this.match.state.playArea.cards.push(card);

      this.logDebug(`PLACE_CARD: '${util.inspect(card)}' area: '${util.inspect(this.match.state.playArea)}'`);
    }

    // -- decrease the number of pending kraken cards
    if (!!this.match.state.pendingEffect?.krakenCount) {
      this.match.state.pendingEffect.krakenCount -= 1;
      this.logDebug(`PLACE_CARD - DEBUG: Kraken pending ${this.match.state.pendingEffect.krakenCount}`);
    }

    // -- check of we need to maintain anything on previous state (Kraken or Oracle clearing)
    switch (this.match.state.pendingEffect?.effectType) {
      case model.OCardEffectType.Kraken:
        // -- maintain and check if Kraken forced card is fulfulled
        if (this.match.state.pendingEffect?.krakenCount === 0) {
          this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
        }
        break;

      case model.OCardEffectType.Oracle:
        // -- maintain as Oracle peeked card is fulfulled
        this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
        break;
    }

    // -- execute effects based on Suit special
    this.postProcessCardAfterPlacement(card);

    return card;
  }

  /**
   * Post processes newly placed card after placement
   * @param card
   */
  private postProcessCardAfterPlacement(card: model.Card) {
    switch (card.suit) {
      case model.OCardSuit.Kraken:
        this.postProcessKraken(card);
        break;
      case model.OCardSuit.Oracle:
        this.postProcessOracle(card);
        break;
      case model.OCardSuit.Hook:
        this.postProcessHook(card);
        break;
      case model.OCardSuit.Cannon:
      case model.OCardSuit.Sword:
        this.postProcessCannonSword(card);
        break;
      case model.OCardSuit.Map:
        this.postProcessMap(card);
        break;
    }
  }

  /**
   * Places a map card
   * @param card
   */
  private postProcessMap(card: model.Card) {
    assert(this.match && this.match.state);

    // -- if discard pile has no elements, just skip
    if (!!this.match.state.discardPile?.length) {
      // -- remove (temp) cards from discard pile, until effect is fulfulled
      const cardsFromDiscard = this.drawCardsFromDiscardPile(3); // TODO: should modify state only after!

      const effect = new model.CardEffect(model.OCardEffectType.Map, cardsFromDiscard);
      {
        this.addEvent(
          new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
            cardPlayedEffect: effect,
          }),
          this.match.state
        );
        this.postProcessAddEffect(effect);

        this.logDebug(`CARDEFFECT: ${card.suit}: ${util.inspect(cardsFromDiscard)} [requires user response]`);
      }
    } else {
      this.logDebug(`CARDEFFECT ${card.suit}: ignored - due to empty discardpile`);
    }
  }

  /**
   * Places a cannon or sword card
   * @param card
   */
  private postProcessCannonSword(card: model.Card) {
    assert(this.match && this.match.state);

    // -- if no other player bank has elements, just skip
    // --  important: Sword cannot choose from suitstack that exists in our bank, while Cannon can pick any
    const anyItemsInAnyBanksFromDifferentSuits = !!this.pickCardForSwordOrCannon(card.suit);
    if (anyItemsInAnyBanksFromDifferentSuits) {
      const effect =
        card.suit === model.OCardSuit.Cannon
          ? new model.CardEffect(model.OCardEffectType.Cannon)
          : new model.CardEffect(model.OCardEffectType.Sword);
      {
        this.addEvent(
          new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
            cardPlayedEffect: effect,
          }),
          this.match.state
        );
        this.postProcessAddEffect(effect, effect.effectType === model.OCardEffectType.Cannon);
      }
      this.logDebug(`CARDEFFECT: ${card.suit} [requires user response]`);
    } else {
      this.logDebug(`CARDEFFECT: ${card.suit}: ignored - due to empty or same_suited enemy banks`);
    }
  }

  /**
   * Places a hook card
   * @param card
   */
  private postProcessHook(card: model.Card) {
    assert(this.match && this.match.state && this.match.state.currentPlayerIndex !== null);
    const bank = this.match.state?.banks[this.match.state.currentPlayerIndex];
    // -- if own bank has no elements, just skip
    if (bank?.flatSize) {
      const effect = new model.CardEffect(model.OCardEffectType.Hook);
      {
        this.addEvent(
          new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
            cardPlayedEffect: effect,
          }),
          this.match.state
        );
        this.postProcessAddEffect(effect);
      }
      this.logDebug(`CARDEFFECT: ${card.suit} [requires user response]`);
    } else {
      this.logDebug(`CARDEFFECT: ${card.suit}: ignored - due to empty bank`);
    }
  }

  /**
   * Places an oracle card
   * @param card
   */
  private postProcessOracle(card: model.Card) {
    assert(this.match && this.match.state);

    // -- if drawpile is empty or there is a kraken in progress, just skip
    if (!!this.match.state.drawPile?.length) {
      const cardPeekedOracle = this.drawCard(false);
      assert(cardPeekedOracle);

      const effect = new model.CardEffect(model.OCardEffectType.Oracle, [cardPeekedOracle, null]); // !! //todo check handling, whether adding null as an option is not a big problem + UI implications
      {
        this.addEvent(
          new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
            cardPlayedEffect: effect,
          }),
          this.match.state
        );
        this.postProcessAddEffect(effect, true);
      }
      this.logDebug(`CARDEFFECT: ${card.suit}: '${util.inspect(cardPeekedOracle)}' [requires user response]`);
    } else {
      this.logDebug(`CARDEFFECT: ${card.suit}: ignored - due to empty drawpile or Kraken.`);
    }
  }

  /**
   * Places a kraken card
   * @param card
   */
  private postProcessKraken(card: model.Card) {
    assert(this.match && this.match.state);
    const krakenCardCount = Math.min(2, this.match.state?.drawPile?.length ?? 0);
    if (krakenCardCount > 0) {
      const effect = new model.CardEffect(model.OCardEffectType.Kraken, undefined, krakenCardCount);
      {
        this.addEvent(
          new model.MatchEvent(model.OMatchEventType.CardPlayedEffect, {
            cardPlayedEffect: effect,
          }),
          this.match.state
        );
        this.match.state.addPendingEffect(effect);
      }

      this.logDebug(`CARDEFFECT: ${card.suit}: ${krakenCardCount} cards [requires user response]`);
    } else {
      this.logDebug(`CARDEFFECT: ${card.suit}: ignored - due to empty drawpile.`);
    }
  }

  /**
   * Add effect at PostProcessing step
   * cancels pending effect kraken, yet optionally transfers all pending kraken due cards
   */
  private postProcessAddEffect(newEffect: model.CardEffect, keepPendingKrakenCards: boolean = false): void {
    assert(this.match && this.match.state);

    // -- if needed (e.g. Oracle, Cannon) keep any due Kraken cards and move to the new effect
    if (keepPendingKrakenCards && this.match.state.pendingEffect?.krakenCount)
      newEffect.krakenCount = this.match.state.pendingEffect?.krakenCount;

    // -- if effect was Kraken, cancel it
    if (this.match.state.pendingEffect?.effectType === model.OCardEffectType.Kraken) {
      this.logDebug(
        `CARDEFFECT: ${model.OCardEffectType.Kraken} terminated due to new effect ${newEffect.effectType} ${
          keepPendingKrakenCards
            ? ' - keeping pending Kraken cards of ' + this.match.state.pendingEffect.krakenCount
            : ''
        }`
      );
      this.match.state.clearPendingEffect(); // -- process pending effect - delete
    }

    // -- finally add the new effect
    this.match.state.addPendingEffect(newEffect);
  }

  /**
   * Moves a card to discardpile
   * @param card selected card
   */
  private discardCard(card: model.Card): void {
    assert(this.match && this.match.state);
    this.logDebug(`DISCARD: '${util.inspect(card)}'`);
    this.match.state.discardPile?.cards.push(card);
  }

  /**
   * Draws cards from discard pile
   * @param numberOfCards target number of cards (can be less if not available)
   * @returns cards from discard pile
   */
  private drawCardsFromDiscardPile(numberOfCards: number): model.Card[] {
    assert(this.match && this.match.state);
    const cardsFromDiscard = new Array<model.Card>();
    for (let i = 0; i < numberOfCards; i++) {
      if (!this.match.state.discardPile?.length) break;

      const idx = Math.floor(this.randomGenerator.getRandom(this.match.state.discardPile.length));
      const card = this.match.state.discardPile.cards[idx];

      cardsFromDiscard.push(card);

      this.match.state.discardPile.cards.splice(idx, 1);
      this.logDebug(`DRAW_CARD_DISCARDPILE: '${util.inspect(card)}'`);
    }
    return cardsFromDiscard;
  }

  /**
   * execute user action to draw a card
   * @returns void promise
   */
  private async subactionDrawPromise(): Promise<void> {
    assert(this.match);
    this.log('>DRAW');
    if (!this.match.move) this.match.move = this.newMove();

    const card = this.drawCard();
    if (card) this.placeCard(card);
  }

  /**
   * Match ending event
   * @returns void promise
   */
  public async matchEnding(isTerminated?: boolean, forcedWinnerIdx?: number | null, comment?: string): Promise<void> {
    assert(this.match && this.match.state);
    this.logDebug('MATCH_ENDING');

    // -- calc scores by tuple: [playeridx, score]
    const scores = new Map<number, number>();
    for (let idx = 0; idx < this.match.playerids.length; idx++) {
      const bank = this.match.state.banks[idx];
      if (bank) scores.set(idx, bank.bankvalue);
    }

    // -- sort by id
    const scoresDesc = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    this.log(`MATCH_ENDED: '${util.inspect(scoresDesc)}' ${comment ?? ''}`);

    // -- determine winning player idx
    let winnerIdx;
    if (forcedWinnerIdx === undefined) {
      // -- normal ending, check for higher score or tie->null
      // -- handle tie situation on first and second place
      if (scoresDesc[0][1] !== scoresDesc[1][1]) winnerIdx = scoresDesc[0][0];
      else winnerIdx = null;
    } else {
      // -- forced ending, find matching player id
      winnerIdx = forcedWinnerIdx;
    }

    // -- add comment event
    if (comment?.length) {
      this.addEvent(new model.MatchEvent(model.OMatchEventType.Comment, { comment }), this.match.state);
      this.match.state.currentPlayerIndex = null;
    }

    // -- add event
    const scoresFlat: number[] = Array.from(scores.values()).map((entry) => entry) as number[];
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.MatchEnded, {
          matchEndedWinnerIdx: winnerIdx,
          matchEndedScores: scoresFlat,
          ...(isTerminated ? { matchEndedTerminated: isTerminated } : {}),
        }),
        this.match.state
      );
      this.match.state.winnerIdx = winnerIdx;
      this.match.state.currentPlayerIndex = null;
    }
  }

  /**
   * Turns ending event
   * @param isSuccessful whether busted or not
   */
  private turnEnding(isSuccessful: boolean): void {
    assert(this.match && this.match.state);
    this.logDebug(`TURN_ENDING ${isSuccessful}`);

    const cardsCollected: model.Card[] = [];
    {
      // -- identify collected cards index
      const startingstate = this.match.state;
      const playArea = startingstate.playArea;
      const collectIndex = isSuccessful
        ? playArea.length
        : playArea.cards.findIndex((e) => e.suit === model.OCardSuit.Anchor);

      // -- process playarea cards
      for (let i = 0; i < playArea.length; i++) {
        const card = playArea.cards[i];
        if (i < collectIndex) {
          // -- add to collected card temp array
          cardsCollected.push(card);
        } else {
          // -- discard card
          this.discardCard(card);
          // NOTE: incorrect, should add this to a new state, but new state is only created at the end - rework later
        }
      }
    }

    // -- identify and add bonus cards for Chest & Key combo, drawn from discard pile
    let bonusCards;
    if (
      cardsCollected.find((c) => c.suit === model.OCardSuit.Chest) &&
      cardsCollected.find((c) => c.suit === model.OCardSuit.Key)
    ) {
      const bonusCardAmount = cardsCollected.length;
      this.logDebug(`BONUS: Key&Chest ${bonusCardAmount}`);
      bonusCards = this.drawCardsFromDiscardPile(bonusCardAmount);
      // NOTE: incorrect, should add this to a new state, but new state is only created at the end - rework later
      bonusCards.forEach((card) => cardsCollected.push(card));
    }

    {
      // -- clear play area
      const state = this.match.state;
      const playArea = state.playArea;
      playArea.cards.length = 0; // (0, playArea.length);
      // NOTE:  incorrect, should add this to a new state, but new state is only created at the end - rework later
    }

    {
      // -- clear any effects
      this.match.state.clearPendingEffect(); // -- remove any pending todos
      // NOTE: incorrect, should add this to a new state, but new state is only created at the end - rework later
    }

    {
      // -- collect cards & add event with turn ended
      assert(this.match.state.currentPlayerIndex !== null);
      const bank = this.match.state.banks[this.match.state.currentPlayerIndex];
      cardsCollected.forEach((card) => {
        // -- add to player's bank
        bank.add(card);
        this.logDebug(`COLLECT: '${util.inspect(card)}'`);
      });
      // NOTE: incorrect, should add this to a new state, but new state is only created at the end - rework later

      // -- create delta structure, only adding props that make sense
      const state0 = this.match.stateAtTurnStart;
      const state1 = this.match.state;
      const delta = this.calculateStateDelta(state0, state1);

      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.TurnEnded, {
          turnEndedIsSuccessful: isSuccessful,
          turnEndedDelta: delta,
          ...(bonusCards ? { turnEndedBonusCards: bonusCards } : {}),
        }),

        this.match.state
      );
      this.log(`TURN_ENDED: 'cards:${util.inspect(cardsCollected)}' ${!isSuccessful ? 'BUSTED!' : ''}`);
    }

    // -- check if there are any drawpile left and move to next player
    if (!!this.match.state?.drawPile?.length) {
      this.match.moveCountInTurn = null; // this indicates start of new turn
      // -- no further action needed here
    } else {
      this.matchEnding();
    }
  }

  /**
   * Turns starting event
   * @param playerIndex selected player
   */
  private turnStarting(playerIndex: number): void {
    assert(this.match && this.match.state);

    let delta: IStateDelta = {};
    if (this.match.stateAtTurnStart) {
      const state0 = this.match.stateAtTurnStart;
      const state1 = this.match.state;

      // -- create delta structure, only adding props that make sense
      delta = this.calculateStateDelta(state0, state1);
    }

    // -- record turnstart state
    this.match.stateAtTurnStart = State.clone(this.match.state); // -- record state at turn start

    // -- create and add event
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.TurnStarted, { turnStartedDelta: delta }),
        this.match.state
      );
      this.match.state.currentPlayerIndex = playerIndex;
    }
    this.log(
      `TURN_START: ${this.match.turnCount}.${this.match.moveCountInTurn}: ` +
        `player-${this.match.state.currentPlayerIndex} ` +
        `${this.match.playerids?.at(this.match.state.currentPlayerIndex)?.toString()}`
    );
  }

  /**
   * Calculates state delta between starting and target states
   * @param state0
   * @param state1
   * @returns state delta
   */
  private calculateStateDelta(state0: model.State, state1: model.State): model.IStateDelta {
    assert(this.match);
    const delta = {
      drawPile: (() => {
        const removed = state0.drawPile?.except(state1.drawPile);
        return { ...(removed?.length ? { removed } : {}) };
      })(),
      discardPile: (() => {
        const removed = state0.discardPile?.except(state1.discardPile);
        const added = state1.discardPile?.except(state0.discardPile);
        return {
          ...(removed?.length ? { removed } : {}),
          ...(added?.length ? { added } : {}),
        };
      })(),
      banks: state0.banks.map((_, idx) =>
        (() => {
          const removed = state0.banks[idx].except(state1.banks[idx]);
          const added = state1.banks[idx].except(state0.banks[idx]);
          return {
            ...(removed?.length ? { removed } : {}),
            ...(added?.length ? { added } : {}),
          };
        })()
      ),
    } as IStateDelta;
    return delta;
  }

  /**
   * execute user action to respond to a card effect
   * @param response input response
   * @param pendingEffect pending effect
   * @returns promise void
   */
  private async subactionRespondToEffectPromise(
    response: model.CardEffectResponse,
    pendingEffect: model.CardEffect
  ): Promise<void> {
    this.respondToEffectLogic(response, pendingEffect, false);
  }

  /**
   * execute user action to respond to a card effect
   * @param response input response
   * @param pendingEffect pending effect
   * @param doAllowAutoPickedResponse allow autopicking on user draw or endturn
   * @returns promise void
   */
  private respondToEffectLogic(
    response: model.CardEffectResponse,
    pendingEffect: model.CardEffect,
    doAllowAutoPickedResponse: boolean = false
  ): void {
    assert(this.match);

    let responseCard = response.card ? model.Card.constructFromObject(response.card) : null;
    if (!doAllowAutoPickedResponse)
      this.logDebug(`>RESPOND_CARDEFFECT: ${response.effectType}:= '${util.inspect(responseCard)}'`);
    if (!pendingEffect) throw new GameError('No pending effects to respond to');

    if (!this.match.move) this.match.move = this.newMove();

    // -- act according to the effect type
    switch (response.effectType) {
      case model.OCardEffectType.Oracle:
        responseCard = this.respondToEffectLogicOracle(response, responseCard, doAllowAutoPickedResponse);
        break;
      case model.OCardEffectType.Kraken:
        this.respondToEffectLogicKraken();
        break;
      case model.OCardEffectType.Hook:
        responseCard = this.respondToEffectLogicHook(doAllowAutoPickedResponse, responseCard, response);
        break;
      case model.OCardEffectType.Cannon:
      case model.OCardEffectType.Sword:
        responseCard = this.respondToEffectLogicCannonSword(
          doAllowAutoPickedResponse,
          responseCard,
          pendingEffect,
          response
        );
        break;
      case model.OCardEffectType.Map:
        responseCard = this.respondToEffectLogicMap(doAllowAutoPickedResponse, responseCard, pendingEffect, response);
        break;
    }
  }

  /**
   * Responds to effect logic suit 'Map'
   * @param doAllowAutoPickedResponse
   * @param responseCard
   * @param pendingEffect
   * @param response
   * @returns
   */
  private respondToEffectLogicMap(
    doAllowAutoPickedResponse: boolean,
    responseCard: model.Card | null | undefined,
    pendingEffect: model.CardEffect,
    response: model.CardEffectResponse
  ) {
    assert(this.match && this.match.state && this.match.state.currentPlayerIndex !== null && pendingEffect);
    if (!doAllowAutoPickedResponse) {
      if (!responseCard) throw new GameError('Effect response must contain a card.');
    } else {
      // -- autopicked response - pick first card that would not bust (no such suit exists in playarea)
      const currentBank = this.match.state.banks[this.match.state.currentPlayerIndex];
      responseCard = pendingEffect.cards?.find(
        (dcard) => !this.match?.state?.playArea.cards.find((pac) => !!dcard && pac.suit === dcard.suit)
      );
      // -- if not found - pick any suit
      if (!responseCard) responseCard = pendingEffect.cards?.at(0);
      if (!responseCard) throw new GameError('Server Error: no cards picked for autopicked Map'); // -- should not happen as we only allow effect to be raised when this is av
    }

    // -- User Responded Effect - Map
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
          responseToEffectType: response.effectType,
          responseToEffectCard: responseCard,
        }),
        this.match.state
      );
      this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
    }

    // -- check if selected card is within the possible cards
    const pendingEffectCards = pendingEffect?.cards;
    if (!responseCard || !pendingEffectCards?.find((c) => !!responseCard && !!c && responseCard.equals(c))) {
      throw new GameError('Inappropriate Card specified for effect response');
    }

    // -- place selected card to playarea AND play others back to discard
    pendingEffectCards?.forEach((c) => {
      if (c && responseCard?.equals(c)) {
        // -- add to playarea
        this.placeCard(c);
      } else if (c) {
        // -- add back to discard
        // -- place back unchosen cards to discardPile -- it is OK not add a new state, modify ResponseToEffect state
        this.discardCard(c);
      }
    });
    return responseCard;
  }

  /**
   * Responds to effect logic suit 'Cannon', 'Sword'
   * @param doAllowAutoPickedResponse
   * @param responseCard
   * @param pendingEffect
   * @param response
   * @returns
   */
  private respondToEffectLogicCannonSword(
    doAllowAutoPickedResponse: boolean,
    responseCard: model.Card | null | undefined,
    pendingEffect: model.CardEffect,
    response: model.CardEffectResponse
  ) {
    assert(this.match && this.match.state);
    if (!doAllowAutoPickedResponse) {
      if (!responseCard) throw new GameError('Effect response must contain a card.');
    } else {
      // -- autopicked response - pick first card that would not bust (no such suit exists in playarea)
      responseCard = this.pickCardForSwordOrCannon(pendingEffect.effectType);
      if (!responseCard) throw new GameError('Server Error: no cards picked for autopicked Cannon/Sword'); // -- should not happen as we only allow effect to be raised when this is av
    }

    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
          responseToEffectType: response.effectType,
          responseToEffectCard: responseCard,
        }),
        this.match.state
      );
      this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
    }

    // -- check if the picked card is the topmost on that stack
    const bankTargetIndex = this.match.state.banks.findIndex((bank, bankIndex) => {
      if (bankIndex === this.match?.state?.currentPlayerIndex) return false;
      assert(responseCard?.suit);
      const suitstack = bank.piles.get(responseCard?.suit);
      if (suitstack?.max() !== responseCard?.value) return false;
      return true;
    });

    // -- check if card is valid - i.e. responded to AND exists in Bank AND is topmost on the stack
    if (bankTargetIndex < 0) throw new GameError('Card does not exist in Enemy Bank(s) or is not the topmost one.');
    // -- Sword: check if card is valid -- we cannot have this suit
    if (response.effectType === model.OCardEffectType.Sword) {
      assert(this.match.state.currentPlayerIndex !== null);
      assert(responseCard.suit);
      if (this.match.state.banks[this.match.state.currentPlayerIndex].piles.has(responseCard.suit))
        throw new GameError('Sword: Player cannot pick a suit that owned already in bank.');
    }

    // -- remove card from bank
    const cardFrombank = responseCard; // new model.Card(responseCard.suit, responseCard.value);
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.CardRemovedFromBank, {
          cardRemovedFromBankCard: cardFrombank,
          cardRemovedFromBankIndex: bankTargetIndex,
        }),
        this.match.state
      );
      this.logDebug(`REMOVE_CARD_FROM_BANK: '${util.inspect(cardFrombank)}' player:${bankTargetIndex}`);

      // -- remove card from bank
      const bankTarget = this.match.state.banks.at(bankTargetIndex);
      assert(bankTarget && responseCard.suit && responseCard.value);
      const suitstack = bankTarget.piles.get(responseCard.suit);
      suitstack?.delete(responseCard.value);
      if (!suitstack?.size) bankTarget.piles.delete(responseCard.suit);
    }

    if (response.effectType === model.OCardEffectType.Cannon) {
      // -- place to DiscardPile
      this.discardCard(cardFrombank);
    } else if (response.effectType === model.OCardEffectType.Sword) {
      // -- place to playarea
      this.placeCard(cardFrombank);
    }
    return responseCard;
  }

  /**
   * Responds to effect logic suit 'Hook'
   * @param doAllowAutoPickedResponse
   * @param responseCard
   * @param response
   * @returns
   */
  private respondToEffectLogicHook(
    doAllowAutoPickedResponse: boolean,
    responseCard: model.Card | null | undefined,
    response: model.CardEffectResponse
  ) {
    assert(this.match && this.match.state && this.match.state.currentPlayerIndex !== null);

    if (!doAllowAutoPickedResponse) {
      if (!responseCard) throw new GameError('Effect response must contain a card.');
    } else {
      // -- autopicked response - pick first card that would not bust (no such suit exists in playarea)
      const currentBank = this.match.state.banks[this.match.state.currentPlayerIndex];
      let pickeditem = [...currentBank.piles].find(
        ([cpacks, cpack]) => !this?.match?.state?.playArea?.cards.find((pac) => pac.suit === cpacks)
      );
      // -- if not found - pick any suit
      if (!pickeditem) pickeditem = [...currentBank.piles].find((kvp) => true);
      assert(pickeditem);

      const [pickedsuit, pickedpile] = pickeditem;
      if (pickedpile) {
        const pickedvalue = pickedpile.max() as model.CardValue;
        responseCard = new model.Card(pickedsuit, pickedvalue);
      }
      if (!responseCard) throw new GameError('Server Error: no cards picked for autopicked Hook'); // -- should not happen as we only allow effect to be raised when this is av
    }

    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
          responseToEffectType: response.effectType,
          responseToEffectCard: responseCard,
        }),
        this.match.state
      );
      this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
    }

    // -- guard: check if card is really the top of the suit
    const bankTargetIndex = this.match.state.currentPlayerIndex;
    {
      const bank = this.match.state.banks[bankTargetIndex];
      assert(responseCard?.suit);
      const suitstack = bank.piles.get(responseCard?.suit);
      // -- check if card is valid - i.e. responded to AND exists in Bank AND is topmost on the stack
      if (bank.piles.get(responseCard?.suit)?.max() !== responseCard?.value) {
        // await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new GameError('Card does not exist in Own Bank or is not the topmost one.');
      }
    }

    // -- remove card from bank
    const cardFrombank = responseCard;
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.CardRemovedFromBank, {
          cardRemovedFromBankCard: cardFrombank,
          cardRemovedFromBankIndex: bankTargetIndex,
        }),
        this.match.state
      );
      this.logDebug(`REMOVE_CARD_FROM_BANK: '${util.inspect(cardFrombank)}' player:${bankTargetIndex}`);

      // -- remove card from bank
      const bankTarget = this.match.state.banks.at(bankTargetIndex);
      assert(bankTarget);
      const suitstack = bankTarget?.piles.get(responseCard.suit);
      assert(suitstack && responseCard.value);
      suitstack.delete(responseCard.value);
      if (suitstack.size === 0) bankTarget.piles.delete(responseCard.suit);
    }

    // -- place to playarea
    this.placeCard(cardFrombank);

    return responseCard;
  }

  /**
   * Responds to effect logic suit 'Kraken'
   */
  private respondToEffectLogicKraken() {
    // -- draw and place the card
    const card = this.drawCard(true);
    if (card) this.placeCard(card);
  }

  /**
   * Responds to effect logic suit 'Oracle'
   * @param response
   * @param responseCard
   * @param doAllowAutoPickedResponse
   * @returns
   */
  private respondToEffectLogicOracle(
    response: model.CardEffectResponse,
    responseCard: model.Card | undefined | null,
    doAllowAutoPickedResponse: boolean
  ) {
    assert(this.match && this.match.state);
    const nextCardPeeked = this.match.state.drawPile?.draw(false);
    if (!nextCardPeeked) throw new GameError('Oracle response without next card.');
    {
      this.addEvent(
        new model.MatchEvent(model.OMatchEventType.ResponseToEffect, {
          responseToEffectType: response.effectType,
          responseToEffectCard: responseCard, // -- shall be either a card or undefined - shall not be null, will cause unmarshall error
        }),
        this.match.state
      );
      this.clearPendingEffectRespectingKrakenCards(); // -- process pending effect - delete, keeping kraken cards if any
    }

    if (!responseCard) {
      // -- card not picked - NO FURTHER ACTION NEEDED
    } else if (doAllowAutoPickedResponse) {
      // -- card autopick, just use the peeked card
      responseCard = nextCardPeeked;
    } else {
      // -- check if card is valid - same or null when placed back
      if (!nextCardPeeked?.equals(responseCard)) {
        // await this.redoCurrentMove(match); // not needed as this wil; not be persisted anyhow
        throw new GameError(
          `Inappropriate Card specified for effect response. Oracle peeked card was: ${JSON.stringify(nextCardPeeked)}.`
        );
      }

      // -- place the card
      const cardFromOracle = this.drawCard(true);
      if (cardFromOracle) this.placeCard(cardFromOracle);
    }
    return responseCard;
  }

  /**
   * Clears pending effect while keeping kraken cards intact
   */
  private clearPendingEffectRespectingKrakenCards() {
    assert(this.match && this.match.state);
    const krakenCount = this.match.pendingEffect?.krakenCount;
    this.match.state.clearPendingEffect();
    if (!!krakenCount) {
      this.match.state.addPendingEffect(new model.CardEffect(model.OCardEffectType.Kraken, undefined, krakenCount));
    }
  }
}
