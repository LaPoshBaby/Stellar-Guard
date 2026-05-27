import axios from "axios";

const RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.FREEZE_CONTRACT_ID ?? "";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

/**
 * Query the on-chain vote count for a proposal via Soroban RPC
 * (simulateTransaction → get_votes).
 * Returns null if the contract is not deployed or RPC is unreachable.
 */
export async function getOnChainVotes(
  assetCode: string,
  target: string
): Promise<number | null> {
  if (!CONTRACT_ID) return null;
  try {
    // Build a minimal simulateTransaction request for get_votes(asset_code, target)
    const StellarSdk = await import("@stellar/stellar-sdk");
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    // Use a throw-away account for simulation (no auth needed for read-only)
    const dummyAccount = new StellarSdk.Account(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "0"
    );

    const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "get_votes",
          StellarSdk.xdr.ScVal.scvString(assetCode),
          StellarSdk.Address.fromString(target).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const { data } = await axios.post(
      RPC_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: { transaction: tx.toXDR() },
      },
      { timeout: 8000 }
    );

    if (data?.result?.results?.[0]?.xdr) {
      const scVal = StellarSdk.xdr.ScVal.fromXDR(
        data.result.results[0].xdr,
        "base64"
      );
      return StellarSdk.scValToNative(scVal) as number;
    }
    return null;
  } catch {
    return null;
  }
}
