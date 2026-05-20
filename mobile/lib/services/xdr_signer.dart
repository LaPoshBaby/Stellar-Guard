import 'package:stellar_flutter_sdk/stellar_flutter_sdk.dart' as stellar;

/// Pluggable signer interface. Implement this to support different signing backends.
abstract class XdrSigner {
  /// Signs [unsignedXdr] and returns the signed XDR envelope, or null on failure.
  Future<String?> sign(String unsignedXdr);
}

/// Signs using an admin secret key stored in flutter_secure_storage.
/// Retained for demo/testnet use.
class InAppKeySigner implements XdrSigner {
  final String secretKey;
  const InAppKeySigner(this.secretKey);

  @override
  Future<String?> sign(String unsignedXdr) async {
    try {
      final kp = stellar.KeyPair.fromSecretSeed(secretKey);
      final tx = stellar.AbstractTransaction.fromEnvelopeXdrString(unsignedXdr);
      tx.sign(kp, stellar.Network.TESTNET);
      return tx.toEnvelopeXdrBase64();
    } catch (_) {
      return null;
    }
  }
}

/// WalletConnect-compatible signer stub.
/// Replace the body of [sign] with a real WalletConnect session request
/// once a Flutter WalletConnect SDK is integrated.
class WalletConnectSigner implements XdrSigner {
  const WalletConnectSigner();

  @override
  Future<String?> sign(String unsignedXdr) async {
    // TODO: initiate a WalletConnect session request to sign [unsignedXdr]
    // and return the signed XDR envelope returned by the wallet.
    // Returns null until WalletConnect integration is complete.
    return null;
  }
}
