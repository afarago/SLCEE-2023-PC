/* tslint:disable:max-classes-per-file */
import 'core-js/es/array/at';

import { Hydrate } from '../../utils/hydration.util';
import Card from './card';
import CardEffect, { CardEffectType } from './cardeffect';
import { integer } from './model';
import State from './state';

export const OMatchEventType = {
  MatchStarted: 'MatchStarted',
  TurnStarted: 'TurnStarted',
  Draw: 'Draw',
  CardPlayedEffect: 'CardPlayedEffect',
  ResponseToEffect: 'ResponseToEffect',
  CardPlacedToPlayArea: 'CardPlacedToPlayArea',
  CardRemovedFromBank: 'CardRemovedFromBank',
  TurnEnded: 'TurnEnded',
  MatchEnded: 'MatchEnded',
} as const;
export type MatchEventType = keyof typeof OMatchEventType;

export interface IStateDelta {
  drawPile?: IStateDeltaStack;
  discardPile?: IStateDeltaStack;
  banks?: IStateDeltaStack[];
}

export interface IStateDeltaStack {
  added?: Card[];
  removed?: Card[];
}

export interface IMatchEventCore {
  eventType?: MatchEventType;
}
export interface IMatchEventCoreState {
  state?: State;
}
export interface IMatchEventParameters {
  matchStartedSeed?: string;
  drawCard?: Card;
  cardPlayedEffect?: CardEffect;
  cardPlacedToPlayAreaCard?: Card;
  cardRemovedFromBankCard?: Card;
  cardRemovedFromBankIndex?: integer;
  turnEndedIsSuccessful?: boolean;
  turnEndedBonusCards?: Card[];
  turnEndedDelta?: IStateDelta;
  matchEndedScores?: number[];
  matchEndedWinnerIdx?: integer | null;
  matchEndedComment?: string;
  matchEndedTerminated?: boolean;
  responseToEffectType?: CardEffectType;
  responseToEffectCard?: Card | null;
  turnStartedDelta?: IStateDelta;

  // LATER: rework as
  // turnStarted?: { player: PlayerId };
  // draw?: { card: Card };
  // cardPlayedEffect?: { effect: CardEffect };
  // cardPlacedToPlayArea?: { card: Card };
  // cardRemovedFromBank?: { card: Card; playerIndex: number };
  // turnEnded?: { cardsCollected: Array<Card>; isSuccessful: boolean };
  // matchEnded?: { scores: Array<number>; winnerId: PlayerId };
  // responseToEffect?: { effectType: string; card: Card };
}

export interface IMatchEvent extends IMatchEventCore, IMatchEventCoreState, IMatchEventParameters {}

/**
 * Match event - representing an atomic event with state changes
 */
export default class MatchEvent implements IMatchEvent {
  static constructFromObject(data: any, obj?: MatchEvent) {
    if (data) {
      obj = obj || new MatchEvent();

      Hydrate.convertFrom(data, 'eventType', 'String', obj);
      Hydrate.convertFrom(data, 'state', State, obj);
      Hydrate.convertFrom(data, 'matchStartedSeed', 'String', obj);
      Hydrate.convertFrom(data, 'cardPlayedEffect', CardEffect, obj);
      Hydrate.convertFrom(data, 'drawCard', Card, obj);
      Hydrate.convertFrom(data, 'cardPlacedToPlayAreaCard', Card, obj);
      Hydrate.convertFrom(data, 'cardRemovedFromBankCard', Card, obj);
      Hydrate.convertFrom(data, 'cardRemovedFromBankIndex', 'Number', obj);
      Hydrate.convertFrom(data, 'turnEndedIsSuccessful', Boolean, obj);
      Hydrate.convertFrom(data, 'turnEndedBonusCards', [Card], obj);
      Hydrate.convertFrom(data, 'turnEndedDelta', 'IStateDelta', obj);
      Hydrate.convertFrom(data, 'matchEndedScores', ['Number'], obj);
      Hydrate.convertFrom(data, 'matchEndedWinnerIdx', 'Number', obj);
      Hydrate.convertFrom(data, 'matchEndedComment', 'String', obj);
      Hydrate.convertFrom(data, 'matchEndedTerminated', Boolean, obj);
      Hydrate.convertFrom(data, 'responseToEffectType', 'CardEffectType', obj);
      Hydrate.convertFrom(data, 'responseToEffectCard', Card, obj); // -- oracle can respond with null, still it is handled
      Hydrate.convertFrom(data, 'turnStartedDelta', 'IStateDelta', obj);
    }
    return obj;
  }

  constructor(eventType?: MatchEventType, params?: IMatchEventParameters) {
    this.eventType = eventType;
    MatchEvent.constructFromObject(params, this);

    // const paramsany = params as any;
    // Object.getOwnPropertyNames(paramsany).forEach((k: any) => {
    //   if (paramsany[k]!==undefined) this[k] = paramsany[k];
    // });
    // // TODO: only assign values that are not undefined
    // //Object.assign(this, params);
  }

  get currentPlayerIndex(): number | undefined {
    return this.state?.currentPlayerIndex;
  }

  // -- implement IMatchEventCore
  eventType?: MatchEventType;
  state?: State;

  // -- implement IMatchEventParameters - would be nice to have auto-implementation somehow
  matchStartedSeed?: string;
  drawCard?: Card;
  cardPlayedEffect?: CardEffect;
  cardPlacedToPlayAreaCard?: Card;
  cardRemovedFromBankCard?: Card;
  cardRemovedFromBankIndex?: integer;
  turnEndedIsSuccessful?: boolean;
  turnEndedBonusCards?: Card[];
  turnEndedDelta?: IStateDelta;
  matchEndedScores?: integer[];
  matchEndedWinnerIdx?: integer | null;
  matchEndedComment?: string;
  matchEndedTerminated?: boolean;
  responseToEffectType?: CardEffectType;
  responseToEffectCard?: Card | null;
  turnStartedDelta?: IStateDelta;
}
