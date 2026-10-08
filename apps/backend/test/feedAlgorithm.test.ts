import { describe, expect, it } from "vitest";
import { interestScore } from "../src/services/feedAlgorithm.js";

describe("feed interest matching", () => {
  it("treats case, #, separators and plurals as the same interest", () => {
    expect(interestScore({ tags: ["#Machine-Learning"], categories: [] }, ["machine learning"])).toBe(12);
    expect(interestScore({ tags: ["startups"], categories: [] }, ["Startup"])).toBe(12);
  });

  it("gives half for a partial match of real words only", () => {
    expect(interestScore({ tags: ["startup funding"], categories: [] }, ["startup"])).toBe(6);
    expect(interestScore({ tags: ["ai"], categories: [] }, ["fair play"])).toBe(0);
    expect(interestScore({ tags: ["business"], categories: [] }, ["busines"])).toBe(6);
  });
});
