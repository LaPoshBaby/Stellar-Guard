#!/usr/bin/env bash
# Deploy freeze-governance contract to Stellar Testnet
# Prerequisites: stellar CLI installed, funded testnet account in identity "deployer"
set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"
WASM="target/wasm32-unknown-unknown/release/stellar_guard_contract.wasm"

echo "==> Building contract..."
cargo build --release --target wasm32-unknown-unknown

echo "==> Optimising wasm..."
stellar contract optimize --wasm "$WASM"

OPTIMISED="${WASM%.wasm}.optimized.wasm"

echo "==> Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMISED" \
  --source "$IDENTITY" \
  --network "$NETWORK")

echo "Contract deployed: $CONTRACT_ID"

echo "==> Initialising with admin addresses..."
# Replace ADMIN1/ADMIN2/ADMIN3 with real testnet addresses
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- init \
  --admins "[\"$ADMIN1\",\"$ADMIN2\",\"$ADMIN3\"]"

echo "Done. Set FREEZE_CONTRACT_ID=$CONTRACT_ID in backend/.env"
