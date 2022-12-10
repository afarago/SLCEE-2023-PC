import { describe, xdescribe, expect, test } from '@jest/globals';
import { ObjectId } from 'mongodb';

import Bank from '../src/models/game/bank';
import Card, { CardSuit, CardValue } from '../src/models/game/card';
import CardSuitStack from '../src/models/game/cardsuitstack';
import DiscardCardPile from '../src/models/game/discardcardpile';
import DrawCardPile from '../src/models/game/drawcardpile';
import Match from '../src/models/game/match';
import { Hydrate } from '../src/utils/hydration.util';

describe('models module', () => {
  test('ObjectId deserialization', () => {
    const data = new ObjectId('637f6ecfe2038651bd0752e6');
    const obj = Hydrate.convertToType(data, ObjectId);

    expect(obj).toBeInstanceOf(ObjectId);
    expect(obj?.toString()).toBe('637f6ecfe2038651bd0752e6');
  });

  test('[ObjectId] deserialization', () => {
    const data = [new ObjectId('637f6ecfe2038651bd0752e6'), new ObjectId('637f6ecfe2038651bd0752e7')];
    const obj = Hydrate.convertToType(data, [ObjectId]);

    expect(obj).toBeInstanceOf(Array<ObjectId>);
    obj.forEach((item: any) => expect(item).toBeInstanceOf(ObjectId));
    expect(obj).toHaveLength(2);
    expect(obj[0]?.toString()).toBe('637f6ecfe2038651bd0752e6');
    expect(obj[1]?.toString()).toBe('637f6ecfe2038651bd0752e7');
  });

  test.each([Card, DrawCardPile, DiscardCardPile, Bank, CardSuitStack, Match].map((Type) => [Type.name, Type]))(
    "Model '%s' serialization, null checks",
    (name: any, Type: any) => {
      {
        const data: any = undefined;
        const obj = Hydrate.convertToType(data, Type);
        expect(obj).toBeUndefined();
      }
      {
        const data: any = null;
        const obj = Hydrate.convertToType(data, Type);
        expect(obj).toBeNull();
      }
    }
  );

  test('Card serialization, json deserialization', () => {
    {
      const data = { suit: 'Oracle', value: 4 };
      const obj = Hydrate.convertToType(data, Card);
      expect(obj).toBeTruthy();
      expect(obj).toEqual(new Card('Oracle', 4));
      expect(obj).toHaveProperty('suit');
      expect(obj).toHaveProperty('value');

      const obj2 = JSON.parse(JSON.stringify(obj));
      expect(obj).toBeTruthy();
      expect(obj2).toEqual(data);
    }
    {
      const data = ['Oracle', 4];
      const obj = Hydrate.convertToType(data, Card);
      expect(obj).toBeTruthy();
      expect(obj).toEqual(new Card('Oracle', 4));
    }
  });

  test.each`
    card
    ${['Mermaid', 2]}
    ${['Mermaid', 10]}
    ${['Hook', 1]}
    ${['Hook', 9]}
    ${['Blahblah', 4]}
    ${[null, 5]}
    ${[undefined, 6]}
  `("Invalid card '$card' deserialization throws error", (cardpojo) => {
    expect(() => Hydrate.convertToType(cardpojo, Card)).toThrow();
    expect(() => Card.constructFromObject(cardpojo)).toThrow();
  });

  test('CardSuitStack deserialization', () => {
    const test = [5, 3];
    const obj = CardSuitStack.constructFromObject(test);

    expect(obj).toBeInstanceOf(CardSuitStack);
    expect(obj?.stack).toContain(3);
    expect(obj?.stack).toContain(5);
    expect(Array.from((obj as CardSuitStack).stack.values())).toHaveLength(2);
  });

  test.each([DrawCardPile, DiscardCardPile].map((Type) => [Type.name, Type]))(
    "CardPile type '%s' serialization, json deserialization",
    (name: any, Type: any) => {
      {
        const data = [
          { suit: 'Oracle', value: 4 },
          { suit: 'Kraken', value: 5 },
        ];

        const obj = Hydrate.convertToType(data, Type);
        expect(obj).toBeTruthy();
        expect(obj).toBeInstanceOf(Type);
        expect(obj?.cards).toBeInstanceOf(Array<Card>);
        expect(obj?.cards).toHaveLength(2);
        obj?.cards.forEach((item: any) => expect(item).toBeInstanceOf(Card));
        expect(obj?.cards[0]).toEqual(new Card('Oracle', 4));
        expect(obj?.cards[1]).toEqual(new Card('Kraken', 5));

        const obj2 = JSON.parse(JSON.stringify(obj));
        expect(obj2).toEqual(data);
      }
    }
  );

  test.each([
    [{ Oracle: [4, 5], Hook: [2, 3] }, [2, 2]],
    [{ Hook: [4] }, [1]],
    [{ Hook: [] }, [0]],
    [{}, []],
    [{ Hook: [3], Anchor: [7], Oracle: [5, 2, 4, 7] }, [1, 1, 4]],
  ])('Bank %# serialization, json deserialization', (data, itemlengths: number[]) => {
    {
      const obj = Hydrate.convertToType(data, Bank);

      expect(obj).toBeTruthy();
      expect(obj).toBeInstanceOf(Bank);
      expect(obj?.piles).toBeInstanceOf(Map<CardSuit, CardValue>);
      expect(Array.from(obj?.piles.entries())).toHaveLength(itemlengths.length);
      Array.from(obj?.piles).forEach((item: any, idx: number) => {
        const [key, value] = item;
        expect(value).toBeInstanceOf(CardSuitStack);
        expect(value.size).toBe(itemlengths[idx]);
      });

      const obj2 = JSON.parse(JSON.stringify(obj));
      expect(obj2).toEqual(data);
    }
  });

  test('Bank Array deserialization', () => {
    {
      const data = [{ Chest: [5, 3] }, { Hook: [3], Anchor: [7], Oracle: [5, 2, 4, 7] }];
      const obj = Hydrate.convertToType(data, [Bank]);
      expect(obj).toBeTruthy();
      expect(obj).toBeInstanceOf(Array<Bank>);
      expect(obj).toHaveLength(2);
      obj.forEach((item: any, idx: number) => {
        expect(item).toBeInstanceOf(Bank);
      });

      const obj2 = JSON.parse(JSON.stringify(obj));
      expect(obj2).toEqual(data);
    }
  });
});

// test('Set<> deserialization', () => {
//   // will not work
//   const data = [3, 5];
//   const type = Set<CardValue>;

//   //!!type xx = InstanceType<typeof type>;
//   //!! if (data) obj.stack = Hydrate.convertToType(data, Set<CardValue>);
//   //!! Set.prototype
//   const obj = Hydrate.convertToType(data, Set<CardValue>);

//   expect(obj).toBeInstanceOf(Set<CardValue>);
//   expect(obj).toContain(3);
//   expect(obj).toContain(5);
//   expect(Array.from(obj.values())).toHaveLength(2);
// });
