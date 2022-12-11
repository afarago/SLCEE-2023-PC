import { CardValue } from './card';

/**
 * Card suit stack - for effective representation of bank collection ordered by suits
 * consists of a set of cardvalues in the given suit stack
 */
export default class CardSuitStack {
  static constructFromObject(data: any, obj?: CardSuitStack) {
    if (data) {
      obj = obj || new CardSuitStack();

      data = data.stack || data;
      // set type is lost during ts->js, cannot retrieve type info! // if (data) obj.stack = Hydrate.convertToType(data, Set<CardValue>);
      if (data && Array.isArray(data)) data.forEach((item: any) => obj?.stack.add(item));
    }
    return obj;
  }

  stack: Set<CardValue>;

  // -- override toJSON
  // -- architectural: it is ok from architectural prespective as de do not have any other subproperties
  toJSON() {
    // return this.stack;
    // -- attention: default serialization cannot handle Set<>
    return [...this.stack];
  }
  toBSON() {
    return this.toJSON();
  }

  add(value: CardValue) {
    // const idx = this.stack.indexOf(value);
    // if (idx >= 0)
    //   throw new Error("Cannot add " + value + " to stack - already exists.");

    // this.stack.push(value);
    this.stack.add(value);
  }
  delete(value: CardValue) {
    // const idx = this.stack.indexOf(value);
    // if (idx < 0) throw new Error("Cannot remove " + value + " from stack.");
    // this.stack.splice(idx, 1);
    this.stack.delete(value);
  }
  get size() {
    // return this.stack.length;
    return this.stack.size;
  }

  constructor() {
    // this.stack = new Array<number>(); //CardValue>();
    this.stack = new Set<CardValue>(); // CardValue>();
  }

  max() {
    return Math.max.apply(null, Array.from(this.stack.values()));
  }
}
