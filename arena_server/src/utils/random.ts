import * as gen from 'random-seed';

export const NO_RANDOM = "norandom";

export default class RandomGenerator {
  constructor(private seed?: string) {
    this.initRandom(seed);
  }
  private randomGenerator: gen.RandomSeed;

  /**
   * Inits random with or without a seed
   * If seed is not a string, then the seed value will be converted to a string. If you don't pass a seed argument, then the generator uses Math.random() as the seed.
   * @param [seed]
   */
  public initRandom(seed?: string) {
    this.seed = seed;
    this.randomGenerator = gen.create(seed);
  }

  /**
   * Returns a random integer between 0 (inclusive) and range (exclusive)
   * @param max
   * @returns random
   */
  public getRandom(max: number): number {
    if (this.seed === NO_RANDOM) return 0;
    return this.randomGenerator.range(max);
  }
}
