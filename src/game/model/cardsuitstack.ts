import { SupportsHydration } from "./model";

/**
 * Card suit stack - for effective representation of bank collection ordered by suits
 */
export default class CardSuitStack implements SupportsHydration {
  populate(pojo: any) {
    // this.stack.splice(0, Infinity);
    this.stack.clear();

    const pojoiter = pojo.stack || pojo;
    if (Array.isArray(pojoiter)) pojoiter?.forEach((pojo: any) => this.add(pojo));
    return this;
  }

  stack: Set<number>; //Array<number>; //CardValue //Set<number>

  //-- override toJSON
  //-- architectural: it is ok from architectural prespective as de do not have any other subproperties
  toJSON() {
    //return this.stack;
    //-- attention: default serialization cannot handle Set<>
    return [...this.stack];
  }
  toBSON() {
    return this.toJSON();
  }

  add(value: number) {
    // const idx = this.stack.indexOf(value);
    // if (idx >= 0)
    //   throw new Error("Cannot add " + value + " to stack - already exists.");

    // this.stack.push(value);
    this.stack.add(value);
  }
  delete(value: number) {
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
    //this.stack = new Array<number>(); //CardValue>();
    this.stack = new Set<number>(); //CardValue>();
  }

  max() {
    return Math.max.apply(null, Array.from(this.stack.values()));
  }
}
