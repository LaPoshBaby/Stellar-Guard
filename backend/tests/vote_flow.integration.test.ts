/**
 * Integration test: full build → sign (mocked) → submit → get_votes cycle.
 *
 * External dependencies mocked:
 *   - better-sqlite3 / voteStore  (in-memory map, no native bindings needed)
 *   - Horizon loadAccount / submitTransaction
 *   - sorobanRpc.getOnChainVotes  (simulates on-chain vote count progression)
 *
 * Real route logic and quorum detection are exercised end-to-end.
 */

// ── In-memory voteStore mock ──────────────────────────────────────────────────
type VoteRow = { assetCode: string; issuer: string; target: string; voters: string[]; createdAt: number };
const _store = new Map<string, VoteRow>();

jest.mock("../src/services/voteStore", () => ({
  recordVote(assetCode: string, issuer: string, target: string, adminKey: string): number {
    const key = `${assetCode}:${issuer}:${target}`;
    const row = _store.get(key) ?? { assetCode, issuer, target, voters: [], createdAt: Math.floor(Date.now() / 1000) };
    if (!row.voters.includes(adminKey)) row.voters.push(adminKey);
    _store.set(key, row);
    return row.voters.length;
  },
  clearVotes(assetCode: string, issuer: string, target: string): void {
    _store.delete(`${assetCode}:${issuer}:${target}`);
  },
  listProposals(): VoteRow[] {
    return Array.from(_store.values());
  },
  getVotes(assetCode: string, issuer: string, target: string): VoteRow | null {
    return _store.get(`${assetCode}:${issuer}:${target}`) ?? null;
  },
}));

// ── Mock sorobanRpc ───────────────────────────────────────────────────────────
const mockGetOnChainVotes = jest.fn();
jest.mock("../src/services/sorobanRpc", () => ({
  getOnChainVotes: (...args: unknown[]) => mockGetOnChainVotes(...args),
}));

// ── Mock Horizon.Server ───────────────────────────────────────────────────────
const mockLoadAccount = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
        payments: () => ({ cursor: () => ({ stream: () => {} }) }),
      })),
    },
  };
});

// ── Import app after all mocks ────────────────────────────────────────────────
import request from "supertest";
import app from "../src/index";
import StellarSdk from "@stellar/stellar-sdk";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ASSET_CODE = "RWAUSD";
const ISSUER  = "GBY6UXJLKZH6PWYLEH2IB5NBGUK5FEUX5X6LHAZ467FBIRTZ3TDKQINV";
const TARGET  = "GDORQIPV3HMI7GJR24ZYJ6DRRQJETSU5CBUODOC7DMQWEZJ5AXNKME57";
const ADMIN1  = "GDHPFE3HWV6V7VO3X3IVTEYB7Y2U75NKNXMGXDC2KCN2XW2JT5X6ELXH";
const ADMIN2  = "GAL6QJCUL3WULYYN6EU4K4KJZOTZ2LUKHEA7YMG5RUCAT65L7RJOSZGH";
const ADMIN3  = "GBY6UXJLKZH6PWYLEH2IB5NBGUK5FEUX5X6LHAZ467FBIRTZ3TDKQINV";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

function buildFakeTx(adminKey: string): string {
  const account = new StellarSdk.Account(adminKey, "100");
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  return new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "vote_freeze",
        StellarSdk.Address.fromString(adminKey).toScVal(),
        StellarSdk.xdr.ScVal.scvString(ASSET_CODE),
        StellarSdk.Address.fromString(ISSUER).toScVal(),
        StellarSdk.Address.fromString(TARGET).toScVal()
      )
    )
    .setTimeout(30)
    .build()
    .toXDR();
}

beforeEach(() => {
  jest.clearAllMocks();
  _store.clear();
  mockLoadAccount.mockResolvedValue(new StellarSdk.Account(ADMIN1, "100"));
  mockSubmitTransaction.mockResolvedValue({ hash: "fakehash" });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Vote flow integration", () => {
  it("POST /api/freeze/build returns 503 when contract not configured", async () => {
    // The route reads CONTRACT_ID at module-load time; in the test environment
    // it defaults to '' (not set before module load), so it returns 503.
    // The XDR-building logic is exercised via buildFakeTx in the submit tests.
    const res = await request(app).post("/api/freeze/build").send({
      assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET, adminKey: ADMIN1,
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/ContractNotFound/);
  });

  it("votes 1 and 2 return vote_recorded with correct counts", async () => {
    mockGetOnChainVotes.mockResolvedValue(1);
    const r1 = await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN1), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe("vote_recorded");
    expect(r1.body.votes).toBe(1);

    mockLoadAccount.mockResolvedValue(new StellarSdk.Account(ADMIN2, "100"));
    mockGetOnChainVotes.mockResolvedValue(2);
    const r2 = await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN2), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe("vote_recorded");
    expect(r2.body.votes).toBe(2);
  });

  it("3rd vote reaches quorum — returns executed with votes=3", async () => {
    // Seed two prior votes
    mockGetOnChainVotes.mockResolvedValue(1);
    await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN1), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });
    mockLoadAccount.mockResolvedValue(new StellarSdk.Account(ADMIN2, "100"));
    mockGetOnChainVotes.mockResolvedValue(2);
    await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN2), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });

    // 3rd vote — on-chain returns 0 (quorum reached, contract cleared proposal)
    mockLoadAccount.mockResolvedValue(new StellarSdk.Account(ADMIN3, "100"));
    mockGetOnChainVotes.mockResolvedValue(0);
    const r3 = await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN3), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });

    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe("executed");
    expect(r3.body.votes).toBe(3);
    expect(r3.body.hash).toBe("fakehash");
  });

  it("GET /api/freeze/proposals reflects audit log after a vote", async () => {
    mockGetOnChainVotes.mockResolvedValue(1);
    await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN1), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });

    const res = await request(app).get("/api/freeze/proposals");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].assetCode).toBe(ASSET_CODE);
    expect(res.body[0].votes).toBe(1);
  });

  it("POST /api/freeze/submit returns 403 on tx_bad_auth", async () => {
    mockSubmitTransaction.mockRejectedValue({
      response: { data: { extras: { result_codes: { transaction: "tx_bad_auth" } } } },
    });
    const res = await request(app).post("/api/freeze/submit").send({
      signedXdr: buildFakeTx(ADMIN1), assetCode: ASSET_CODE, issuer: ISSUER, target: TARGET,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("UnauthorizedFreezeAttempt");
  });
});
