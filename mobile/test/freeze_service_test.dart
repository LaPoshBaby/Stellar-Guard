import 'package:flutter_test/flutter_test.dart';
import 'package:stellar_guard_mobile/services/freeze_service.dart';

void main() {
  test('FreezeProposal parses from JSON', () {
    final p = FreezeProposal.fromJson({
      'assetCode': 'RWAUSD',
      'issuer': 'GABC',
      'target': 'GXYZ',
      'votes': 2,
    });
    expect(p.assetCode, 'RWAUSD');
    expect(p.votes, 2);
  });
}
