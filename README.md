# ⚡ Stellar-Guard

> The first UI-driven interface for **CAP-0077 (Quorum Freeze)**, allowing RWA issuers to quarantine compromised assets on the Stellar network.

---

## ⚠️ CAP-0077 Status Disclaimer

**The `freeze_entry` host function defined in CAP-0077 is not yet available on Stellar testnet.**

Stellar-Guard's governance layer — multisig voting, quorum enforcement, admin management, proposal TTL — is **fully functional and deployed on testnet today**. When a quorum of 3 admins votes, the contract emits a `FREEZE` event on-chain (visible in Stellar Explorer).

The final step — calling `freeze_entry` to actually restrict the target account's trustline — will be a **one-line replacement** in `vote_freeze` once the host function is stabilised:

```rust
// Current (event-based, testnet-compatible):
env.events().publish((symbol_short!("FREEZE"), asset_code, issuer, target), vote_count);

// Future (one-line swap when freeze_entry is available):
env.freeze_entry(issuer, target, asset_code);
```

Everything else in the stack — dashboard, Horizon monitor, Freighter signing, mobile biometric approval, Soroban RPC vote queries — works end-to-end on testnet right now.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Stellar-Guard                           │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  Frontend    │   │   Backend    │   │  Smart Contract│  │
│  │  Next.js 14  │◄──│  Express/TS  │◄──│  Soroban/Rust  │  │
│  │  Freighter   │   │  Horizon     │   │  FreezeGov     │  │
│  │  Dashboard   │   │  + Soroban   │   │  Quorum=3      │  │
│  └──────────────┘   │  RPC         │   └────────────────┘  │
│                     └──────────────┘                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Mobile App (Flutter) — Emergency Alert              │   │
│  │  Biometric approval · FCM push · stellar_flutter_sdk │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | Next.js 14, Tailwind, Freighter | Command Center dashboard — live ledger explorer + freeze voting UI |
| `backend/` | Node.js, Express, TypeScript, SQLite | Horizon monitor + REST API; vote counts read from Soroban RPC |
| `contracts/freeze-governance/` | Rust, Soroban SDK 20.5 | Multisig freeze governance — CAP-0077 quorum trigger |
| `mobile/` | Flutter, FCM, local_auth, stellar_flutter_sdk | Emergency Alert app — biometric freeze approval with real XDR signing |

---

## Demo

### Vote Flow (end-to-end)

1. Connect Freighter wallet (set to Testnet) in the dashboard
2. Enter asset code, issuer, and target account in the Freeze Panel
3. Click **Vote to Freeze** — Freighter prompts for signature
4. Repeat from 2 more admin accounts (or use the mobile app)
5. On the 3rd vote, the contract emits a `FREEZE` event — visible at:
   `https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>`

### Mobile Approval Flow

1. Store admin keys in Flutter secure storage:
   ```dart
   await storage.write(key: 'admin_public_key', value: 'G...');
   await storage.write(key: 'admin_secret_key', value: 'S...');
   ```
2. Open the app — pending proposals appear automatically
3. Tap **Approve with Biometrics** — fingerprint/face ID gates the signing
4. `stellar_flutter_sdk` signs the XDR with the stored key
5. Signed transaction is submitted to the network

---

## Quick Start

### Docker Quick-Start (backend + frontend)

> Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.

```bash
# 1. Copy and fill in your contract ID (all other vars have testnet defaults)
cp backend/.env.example .env
# Edit .env — set FREEZE_CONTRACT_ID at minimum

# 2. Start backend (:4000) and frontend (:3000)
docker compose up --build

# Open http://localhost:3000
```

To stop: `docker compose down`

---

### Prerequisites
- Node.js 20+
- Rust + `wasm32-unknown-unknown` target
- Flutter 3.19+
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Freighter wallet](https://www.freighter.app/) browser extension

### 1. Smart Contract (Testnet)

```bash
cd contracts/freeze-governance

# Fund 3 testnet accounts: https://laboratory.stellar.org/#account-creator
# Add them to Stellar CLI identities:
stellar keys generate admin1 --network testnet
stellar keys generate admin2 --network testnet
stellar keys generate admin3 --network testnet

# Build and deploy
cargo build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_guard_contract.wasm

CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_guard_contract.optimized.wasm \
  --source admin1 \
  --network testnet)

echo "CONTRACT_ID=$CONTRACT_ID"

# Initialize with 3 admins
ADMIN1=$(stellar keys address admin1)
ADMIN2=$(stellar keys address admin2)
ADMIN3=$(stellar keys address admin3)

stellar contract invoke \
  --id "$CONTRACT_ID" --source admin1 --network testnet \
  -- init --admins "[\"$ADMIN1\",\"$ADMIN2\",\"$ADMIN3\"]"
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in: FREEZE_CONTRACT_ID, ALLOWED_ORIGIN (your frontend URL)
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Set NEXT_PUBLIC_API_URL to your backend URL
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Mobile

```bash
cd mobile
flutter pub get
flutter run
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transfers` | Recent payment stream (last 200) |
| `GET` | `/api/transfers/asset/:code` | Filter by asset code |
| `POST` | `/api/freeze/build` | Build unsigned freeze XDR |
| `POST` | `/api/freeze/submit` | Submit signed XDR; vote count read from chain |
| `GET` | `/api/freeze/proposals` | Pending proposals with on-chain vote counts |
| `GET` | `/health` | Health check |

### POST `/api/freeze/build`
```json
{
  "assetCode": "RWAUSD",
  "issuer": "G...",
  "target": "G...",
  "adminKey": "G..."
}
```

---

## Smart Contract

The `FreezeGovernance` contract implements CAP-0077 multisig governance:

| Function | Description |
|----------|-------------|
| `init(admins)` | Initialize with authorized admin addresses (one-time) |
| `vote_freeze(caller, asset_code, issuer, target)` | Cast admin vote; emits `FREEZE` event at quorum=3 |
| `revoke_vote(caller, asset_code, target)` | Retract a previously cast vote |
| `get_votes(asset_code, target)` | Query current on-chain vote count |
| `add_admin(caller, new_admin)` | Add admin (requires existing admin auth) |
| `remove_admin(caller, admin_to_remove)` | Remove admin (cannot remove last admin) |

**Storage:** Admin list in `instance` storage (persistent). Proposals in `temporary` storage with 7-day TTL (~120,960 ledgers).

**Vote count authority:** The backend reads vote counts from the contract via Soroban RPC (`simulateTransaction → get_votes`). SQLite is an audit log only.

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `contract-ci.yml` | Push to `contracts/` | Rust fmt, clippy, WASM build |
| `backend-ci.yml` | Push to `backend/` | TypeScript check + Jest tests |
| `frontend-deploy.yml` | Push to `main` | Next.js build + lint + Vercel deploy |

### Required GitHub Secrets (for Vercel deploy)

Add these in **Settings → Secrets and variables → Actions**:

| Secret | How to obtain |
|--------|---------------|
| `VERCEL_TOKEN` | Vercel dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel dashboard → Team/Personal Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |
| `NEXT_PUBLIC_API_URL` | Your deployed backend URL, e.g. `https://stellar-guard-api.onrender.com` |

### Live URL

> **Frontend:** https://stellar-guard.vercel.app *(update after first deploy)*

---

## Error Handling

| Error | Handling |
|-------|----------|
| `ContractNotFound` | Backend returns 503; frontend shows banner |
| `UnauthorizedFreezeAttempt` | Backend returns 403; frontend shows banner |
| `NetworkTimeout` | Backend returns 504; frontend retries silently |
| Soroban RPC unavailable | Falls back to SQLite audit log count |

---

## Testnet Simulation

1. Issue a custom RWA token via [Stellar Laboratory](https://laboratory.stellar.org)
2. Fund 3 admin accounts on testnet
3. Deploy contract with the steps above
4. Connect Freighter (set to Testnet) in the dashboard
5. Submit freeze votes from 3 admin accounts to trigger quorum
6. Observe the `FREEZE` event in [Stellar Expert](https://stellar.expert/explorer/testnet)

---

## License

MIT
