/* tslint:disable:max-classes-per-file */
import * as model from "./model";

export const OMatchEventType = {
  MatchStarted: 0,
  TurnStarted: 1,
  Draw: 2,
  CardPlayedEffect: 3,
  ResponseToEffect: 4,
  CardPlacedToPlayArea: 5,
  CardRemovedFromBank: 6,
  EndTurn: 7,
  TurnEnded: 8,
  MatchEnded: 9,
  // QueryDrawPile: 10,
  // QueryDiscardPile: 11,
  // QueryMatchStatus: 12,
} as const;
export type MatchEventType = keyof typeof OMatchEventType;

export class MatchEventBase {
  readonly eventType: MatchEventType = null;
  state: model.MatchState;
  get currentPlayerIndex(): model.PlayerId {
    return this.state.currentPlayerIndex;
  }
}
export class MatchAction extends MatchEventBase {
  readonly eventType: MatchEventType = null;
  get actionVerb(): string {
    return this.eventType;
  }
}

export class MatchStarted extends MatchEventBase {
  readonly eventType: MatchEventType = "MatchStarted";
}
export class TurnStarted extends MatchEventBase {
  readonly eventType: MatchEventType = "TurnStarted";
  player: model.PlayerId;
  constructor(player: model.PlayerId) {
    super();
    this.player = player;
  }
}
export class Draw extends MatchAction {
  readonly eventType: MatchEventType = "Draw";
  readonly card: model.Card;
  constructor(card: model.Card) {
    super();
    this.card = card;
  }
}
export class CardPlacedToPlayArea extends MatchEventBase {
  readonly eventType: MatchEventType = "CardPlacedToPlayArea";
  readonly card: model.Card;
  readonly direction: boolean;
  constructor(card: model.Card, direction: boolean = true) {
    super();
    this.card = card;
  }
}
export class CardPlayedEffect extends MatchEventBase {
  readonly eventType: MatchEventType = "CardPlayedEffect";
  readonly effect: CardEffectBase;
  constructor(effect: CardEffectBase) {
    super();
    this.effect = effect;
  }
}
export class TurnEnded extends MatchEventBase {
  readonly eventType: MatchEventType = "TurnEnded";
  readonly cardsCollected: Array<model.Card>;
  readonly isSuccessful: boolean;
  constructor(isSuccessful: boolean, cardsCollected: Array<model.Card>) {
    super();
    this.isSuccessful = isSuccessful;
    this.cardsCollected = cardsCollected;
  }
}
export class EndTurn extends MatchAction {
  readonly eventType: MatchEventType = "EndTurn";
}
export class MatchEnded extends MatchEventBase {
  readonly eventType: MatchEventType = "MatchEnded";
  scores: Array<number>;
  winner: model.PlayerId;
}
export class CardRemovedFromBank extends MatchEventBase {
  readonly eventType: MatchEventType = "CardRemovedFromBank";
  readonly card: model.Card;
  readonly playerIndex: number;
  constructor(card: model.Card, playerIndex: number) {
    super();
    this.card = card;
    this.playerIndex = playerIndex;
  }
}

//====
export class ResponseToEffect extends MatchAction {
  readonly eventType: MatchEventType = "ResponseToEffect";
  readonly name: string;
  readonly card: model.Card;
  constructor(name: string, card: model.Card) {
    super();
    this.name = name;
    //LATER: e.g.cannon/sword - in case of multiplayer player is not (directly) covered -- card determines though
    this.card = card;
  }
}

export class CardEffectBase {
  readonly effectType: string; //!! //TODO: enum
}
export class CardEffectOracle extends CardEffectBase {
  readonly effectType: string = "Oracle";
  readonly card: model.Card;
  constructor(card: model.Card) {
    super();
    this.card = card;
  }
}
export class CardEffectHook extends CardEffectBase {
  readonly effectType: string = "Hook";
}
export class CardEffectCannon extends CardEffectBase {
  readonly effectType: string = "Cannon";
}
export class CardEffectSword extends CardEffectBase {
  readonly effectType: string = "Sword";
}
export class CardEffectMap extends CardEffectBase {
  readonly effectType: string = "Map";
  readonly cards: Array<model.Card> = [];
  constructor(cards: Array<model.Card>) {
    super();
    this.cards = cards;
  }
}
