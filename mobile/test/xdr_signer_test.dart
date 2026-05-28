import 'package:flutter_test/flutter_test.dart';
import 'package:stellar_guard_mobile/services/xdr_signer.dart';

void main() {
  group('WalletConnectSigner', () {
    test('sign returns null (stub until WalletConnect is integrated)', () async {
      const signer = WalletConnectSigner();
      final result = await signer.sign('some_unsigned_xdr');
      expect(result, isNull);
    });

    test('is const-constructible', () {
      const a = WalletConnectSigner();
      const b = WalletConnectSigner();
      expect(a, isA<XdrSigner>());
      expect(b, isA<XdrSigner>());
    });
  });

  group('InAppKeySigner', () {
    test('sign returns null for invalid secret key', () async {
      const signer = InAppKeySigner('INVALID_SECRET_KEY');
      final result = await signer.sign('some_unsigned_xdr');
      expect(result, isNull);
    });

    test('is an XdrSigner', () {
      const signer = InAppKeySigner('SCZANGBA5YELQQIL55CBTLRSXEQQI33IOEF5WWA25DEEPSMRSC4FEEFV');
      expect(signer, isA<XdrSigner>());
    });
  });
}
