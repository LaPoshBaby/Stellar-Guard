# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (testnet) | ✅ Active |

Stellar-Guard is currently deployed on **Stellar testnet only**. Mainnet deployment is pending CAP-0077 (`freeze_entry`) stabilisation.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report vulnerabilities by emailing the maintainer directly. Include:

1. A clear description of the vulnerability
2. Steps to reproduce
3. Potential impact (e.g., unauthorised freeze vote, admin key exposure)
4. Any suggested mitigations

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Scope

The following are in scope:

- `contracts/freeze-governance/` — Soroban multisig governance contract
- `backend/` — Express API (vote submission, XDR building, Horizon monitor)
- `frontend/` — Next.js dashboard (Freighter wallet integration)
- `mobile/` — Flutter emergency alert app (biometric signing, key storage)

## Known Limitations

### Mobile Key Storage

The Flutter mobile app currently stores admin secret keys in Flutter Secure Storage (device keychain). This is a **known limitation** tracked in [issue #23](https://github.com/omolobamoyinoluwa-max/Stellar-Guard/issues/23).

**Risk:** If a device is compromised, the stored secret key could be extracted.

**Mitigation until hardware wallet support lands:**
- Use a dedicated device for the mobile app
- Rotate admin keys immediately if a device is lost or stolen
- Remove the compromised admin via `remove_admin` on the contract before the attacker can cast a vote

### CAP-0077 Status

The `freeze_entry` host function is not yet live on Stellar mainnet. The current contract emits a `FREEZE` event at quorum but does not yet restrict trustlines. This means a successful quorum vote is **observable but not yet enforceable** at the protocol level.

## Responsible Disclosure

We follow a **90-day responsible disclosure** policy. If a fix cannot be shipped within 90 days, we will coordinate with the reporter on an appropriate disclosure timeline.

## Contact

Open a [GitHub Security Advisory](https://github.com/omolobamoyinoluwa-max/Stellar-Guard/security/advisories/new) or email the maintainer via the GitHub profile.
