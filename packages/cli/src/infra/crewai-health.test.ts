import { describe, expect, it } from "vitest";
import {
  buildLocalCrewAiUrl,
  parseCrewAiHostPort,
} from "./crewai-health.js";

describe("parseCrewAiHostPort", () => {
  it("parses loopback host:container binding", () => {
    expect(parseCrewAiHostPort("127.0.0.1:8071:8071")).toBe(8071);
  });

  it("parses host:container shorthand", () => {
    expect(parseCrewAiHostPort("8071:8071")).toBe(8071);
  });

  it("parses bare host port", () => {
    expect(parseCrewAiHostPort("8071")).toBe(8071);
  });
});

describe("buildLocalCrewAiUrl", () => {
  it("builds localhost url", () => {
    expect(buildLocalCrewAiUrl(8071)).toBe("http://127.0.0.1:8071");
  });
});
