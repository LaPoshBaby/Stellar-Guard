import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class FreezeProposal {
  final String assetCode;
  final String issuer;
  final String target;
  final int votes;

  const FreezeProposal({
    required this.assetCode,
    required this.issuer,
    required this.target,
    required this.votes,
  });

  factory FreezeProposal.fromJson(Map<String, dynamic> j) => FreezeProposal(
        assetCode: j['assetCode'] as String,
        issuer: j['issuer'] as String,
        target: j['target'] as String,
        votes: j['votes'] as int,
      );
}

class FreezeService extends ChangeNotifier {
  static const _base = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

  List<FreezeProposal> proposals = [];
  bool loading = false;
  String? error;

  Future<void> fetchProposals() async {
    loading = true;
    error = null;
    notifyListeners();

    const delays = [1, 2, 4]; // seconds between retries
    Exception? lastError;

    for (var attempt = 0; attempt <= delays.length; attempt++) {
      try {
        final res = await http
            .get(Uri.parse('$_base/api/freeze/proposals'))
            .timeout(const Duration(seconds: 10));
        if (res.statusCode == 200) {
          final list = jsonDecode(res.body) as List;
          proposals = list
              .map((e) => FreezeProposal.fromJson(e as Map<String, dynamic>))
              .toList();
          lastError = null;
          break; // success
        } else {
          error = 'Server error ${res.statusCode}';
          break; // non-retryable HTTP error
        }
      } on Exception catch (e) {
        lastError = e;
        if (attempt < delays.length) {
          await Future.delayed(Duration(seconds: delays[attempt]));
        }
      }
    }

    if (lastError != null) {
      error = lastError.toString().contains('TimeoutException')
          ? 'NetworkTimeout'
          : lastError.toString();
    }

    loading = false;
    notifyListeners();
  }

  /// Build unsigned XDR from backend. The caller MUST sign this XDR
  /// with their admin wallet before calling [submitSignedVote].
  Future<String?> buildFreezeXdr({
    required String assetCode,
    required String issuer,
    required String target,
    required String adminKey,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_base/api/freeze/build'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'assetCode': assetCode,
              'issuer': issuer,
              'target': target,
              'adminKey': adminKey,
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;
      return (jsonDecode(res.body) as Map<String, dynamic>)['xdr'] as String;
    } on Exception {
      return null;
    }
  }

  /// Submit a SIGNED XDR. The XDR must be signed by the admin's private key
  /// before calling this method. Submitting unsigned XDR will be rejected
  /// by the Stellar network with tx_bad_auth.
  Future<({bool ok, String? error})> submitSignedVote({
    required String signedXdr,
    required String assetCode,
    required String issuer,
    required String target,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_base/api/freeze/submit'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'signedXdr': signedXdr,
              'assetCode': assetCode,
              'issuer': issuer,
              'target': target,
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode == 200) return (ok: true, error: null);
      final msg = (jsonDecode(res.body) as Map<String, dynamic>)['error'] as String? ?? 'Unknown error';
      return (ok: false, error: msg);
    } on Exception catch (e) {
      return (ok: false, error: e.toString());
    }
  }
}
