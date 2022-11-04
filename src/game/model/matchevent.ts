/* tslint:disable:max-classes-per-file */
import "core-js/es/array/at";

import MatchState from "./matchstate";
import Player, { PlayerId } from "./player";
import { SupportsHydration } from "./model";
import CardEffect from "./cardeffect";
import Card from "./card";

export const OMatchEventType = {
  MatchStarted: "MatchStarted",
  TurnStarted: "TurnStarted",
  Draw: "Draw",
  CardPlayedEffect: "CardPlayedEffect",
  ResponseToEffect: "ResponseToEffect",
  CardPlacedToPlayArea: "CardPlacedToPlayArea",
  CardRemovedFromBank: "CardRemovedFromBank",
  EndTurn: "EndTurn",
  TurnEnded: "TurnEnded",
  MatchEnded: "MatchEnded",
  // QueryDrawPile: 10,
  // QueryDiscardPile: 11,
  // QueryMatchStatus: 12,
} as const;
type MatchEventType = keyof typeof OMatchEventType;

export type MatchEventParemeters = {
  turnStartedPlayer?: PlayerId;
  drawCard?: Card;
  cardPlayedEffect?: CardEffect;
  cardPlacedToPlayAreaCard?: Card;
  cardRemovedFromBankCard?: Card;
  cardRemovedFromBankIndex?: number;
  turnEndedCardsCollected?: Array<Card>;
  turnEndedIsSuccessful?: boolean;
  matchEndedScores?: Array<number>;
  matchEndedWinner?: PlayerId;
  responseToEffectType?: string;
  responseToEffectCard?: Card; //LATER: e.g.cannon/sword - in case of multiplayer player is not (directly) covered -- card determines though
};

/**
 * Match event - representing an atomic event with state changes
 */
export default class MatchEvent implements SupportsHydration {
  populate(pojo: any) {
    if (pojo.hasOwnProperty("eventType")) this.eventType = pojo.eventType;
    if (pojo.hasOwnProperty("state")) this.state = new MatchState().populate(pojo.state);

    if (pojo.hasOwnProperty("turnStartedPlayer")) this.turnStartedPlayer = pojo.turnStartedPlayer;
    if (pojo.hasOwnProperty("drawCard")) this.drawCard = new Card().populate(pojo.drawCard);
    if (pojo.hasOwnProperty("cardPlayedEffect"))
      this.cardPlayedEffect = new CardEffect().populate(pojo.cardPlayedEffect);
    if (pojo.hasOwnProperty("cardPlacedToPlayAreaCard"))
      this.cardPlacedToPlayAreaCard = new Card().populate(pojo.cardPlacedToPlayAreaCard);
    if (pojo.hasOwnProperty("cardRemovedFromBankCard"))
      this.cardRemovedFromBankCard = new Card().populate(pojo.cardRemovedFromBankCard);
    if (pojo.hasOwnProperty("cardRemovedFromBankIndex"))
      this.cardRemovedFromBankIndex = pojo.cardRemovedFromBankIndex;
    if (pojo.hasOwnProperty("turnEndedCardsCollected"))
      this.turnEndedCardsCollected = pojo.turnEndedCardsCollected.map((pojoiter: any) =>
        new Card().populate(pojoiter)
      );
    if (pojo.hasOwnProperty("turnEndedIsSuccessful"))
      this.turnEndedIsSuccessful = pojo.turnEndedIsSuccessful;
    if (pojo.hasOwnProperty("matchEndedScores")) this.matchEndedScores = pojo.matchEndedScores;
    if (pojo.hasOwnProperty("matchEndedWinner")) this.matchEndedWinner = pojo.matchEndedWinner;
    if (pojo.hasOwnProperty("responseToEffectType"))
      this.responseToEffectType = pojo.responseToEffectType;
    if (pojo.hasOwnProperty("responseToEffectCard"))
      this.responseToEffectCard = pojo.responseToEffectCard
        ? new Card().populate(pojo.responseToEffectCard)
        : null; //-- oracle can respond with null

    return this;
  }

  eventType?: MatchEventType;
  state?: MatchState;

  constructor(eventType?: MatchEventType, params?: MatchEventParemeters) {
    this.eventType = eventType;
    Object.assign(this, params);
  }

  get currentPlayerIndex(): number | undefined {
    return this.state?.currentPlayerIndex;
  }

  //TODO: use MatchEventParemeters
  turnStartedPlayer: PlayerId;
  drawCard: Card;
  cardPlayedEffect: CardEffect;
  cardPlacedToPlayAreaCard: Card;
  cardRemovedFromBankCard: Card;
  cardRemovedFromBankIndex: number;
  turnEndedCardsCollected: Array<Card>;
  turnEndedIsSuccessful: boolean;
  matchEndedScores: Array<number>;
  matchEndedWinner: PlayerId;
  responseToEffectType: string;
  responseToEffectCard: Card; //LATER: e.g.cannon/sword - in case of multiplayer player is not (directly) covered -- card determines though
}
