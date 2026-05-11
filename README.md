# ⚡ Stellar-Guard

> The first UI-driven interface for **CAP-0077 (Quorum Freeze)**, allowing RWA issuers to quarantine compromised assets on the Stellar network.

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
│  │  Dashboard   │   │  Monitor     │   │  Quorum=3      │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Mobile App (Flutter) — Emergency Alert              │   │
│  │  Biometric approval · FCM push · Admin wallet        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | Next.js 14, Tailwind, Freighter | Command Center dashboard — live ledger explorer + freeze voting UI |
| `backend/` | Node.js, Express, TypeScript | Horizon payment stream monitor + REST API |
| `contracts/freeze-governance/` | Rust, Soroban SDK | Multisig freeze governance — CAP-0077 quorum trigger |
| `mobile/` | Flutter, FCM, local_auth | Emergency Alert app — biometric freeze approval |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Rust + `wasm32-unknown-unknown` target
- Flutter 3.19+
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Freighter wallet](https://www.freighter.app/) browser extension

### 1. Smart Contract (Testnet)

```bash
cd contracts/freeze-governance
# Fund a testnet account first: https://laboratory.stellar.org/#account-creator
ADMIN1=G... ADMIN2=G... ADMIN3=G... bash deploy.sh
# Copy the printed CONTRACT_ID
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Set FREEZE_CONTRACT_ID in .env
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
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
| `POST` | `/api/freeze/submit` | Submit signed XDR + record vote |
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

- **`init(admins)`** — Initialize with authorized admin addresses
- **`vote_freeze(asset_code, issuer, target)`** — Cast admin vote; emits `FREEZE` event at quorum
- **`get_votes(asset_code, target)`** — Query current vote count
- **`add_admin(new_admin)`** — Add an admin address

Quorum is set to **3 votes**. On quorum, a `FREEZE` event is emitted (CAP-0077 `freeze_entry` host function integration pending testnet stabilisation).

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `contract-ci.yml` | Push to `contracts/` | Rust fmt, clippy, test, WASM build |
| `backend-ci.yml` | Push to `backend/` | TypeScript check + Jest tests |
| `frontend-deploy.yml` | Push to `main` | Next.js build + Vercel deploy |

### Required GitHub Secrets
```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
NEXT_PUBLIC_API_URL
```

---

## Error Handling

| Error | Handling |
|-------|----------|
| `ContractNotFound` | Backend returns 503; frontend shows banner |
| `UnauthorizedFreezeAttempt` | Backend returns 403; frontend shows banner |
| `NetworkTimeout` | Backend returns 504; frontend retries silently |

---

## Testnet Simulation

1. Issue a custom RWA token via [Stellar Laboratory](https://laboratory.stellar.org)
2. Fund 3 admin accounts on testnet
3. Deploy contract with `deploy.sh`
4. Connect Freighter (set to Testnet) in the dashboard
5. Submit freeze votes from 3 admin accounts to trigger quorum

---

## License

MIT
