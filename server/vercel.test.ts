import { describe, expect, it } from "vitest";
import { createVercelApp } from "./vercel";

describe("Vercel serverless adapter", () => {
  it("creates an Express application for Vercel's function runtime", () => {
    const app = createVercelApp();

    expect(typeof app).toBe("function");
    expect(app).toHaveProperty("use");
  });

  it("uses a callable request handler as the serverless entrypoint", () => {
    const handler = createVercelApp();

    expect(handler.length).toBeGreaterThanOrEqual(2);
  });
});
