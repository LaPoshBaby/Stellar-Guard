import request from "supertest";
import app from "../src/index";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/transfers", () => {
  it("returns array", async () => {
    const res = await request(app).get("/api/transfers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/freeze/build", () => {
  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/freeze/build").send({});
    expect(res.status).toBe(400);
  });
});
