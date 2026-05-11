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
    try {
      final res = await http.get(Uri.parse('$_base/api/freeze/proposals'))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List;
        proposals = list.map((e) => FreezeProposal.fromJson(e as Map<String, dynamic>)).toList();
      } else {
        error = 'Server error ${res.statusCode}';
      }
    } on Exception catch (e) {
      error = e.toString().contains('TimeoutException') ? 'NetworkTimeout' : e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<bool> approveFreeze({
    required String assetCode,
    required String issuer,
    required String target,
    required String adminKey,
  }) async {
    try {
      // Step 1: build unsigned XDR
      final buildRes = await http
          .post(
            Uri.parse('$_base/api/freeze/build'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'assetCode': assetCode, 'issuer': issuer, 'target': target, 'adminKey': adminKey}),
          )
          .timeout(const Duration(seconds: 15));
      if (buildRes.statusCode != 200) return false;

      final xdr = (jsonDecode(buildRes.body) as Map<String, dynamic>)['xdr'] as String;

      // Step 2: submit (signing via mobile wallet SDK would happen here in production)
      final submitRes = await http
          .post(
            Uri.parse('$_base/api/freeze/submit'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'signedXdr': xdr, 'assetCode': assetCode, 'issuer': issuer, 'target': target}),
          )
          .timeout(const Duration(seconds: 15));
      return submitRes.statusCode == 200;
    } on Exception {
      return false;
    }
  }
}
