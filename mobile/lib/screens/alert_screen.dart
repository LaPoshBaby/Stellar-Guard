import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';
import '../services/freeze_service.dart';

class AlertScreen extends StatefulWidget {
  const AlertScreen({super.key});

  @override
  State<AlertScreen> createState() => _AlertScreenState();
}

class _AlertScreenState extends State<AlertScreen> {
  final _auth = LocalAuthentication();
  final _storage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FreezeService>().fetchProposals();
    });
  }

  Future<void> _approveWithBiometrics(FreezeProposal p) async {
    // 1. Biometric gate
    final canAuth = await _auth.canCheckBiometrics;
    if (!canAuth) { _showSnack('Biometrics not available on this device'); return; }

    final authenticated = await _auth.authenticate(
      localizedReason: 'Authenticate to approve freeze of ${p.assetCode}',
      options: const AuthenticationOptions(biometricOnly: true),
    );
    if (!authenticated) return;

    // 2. Load admin public key from secure storage
    final adminKey = await _storage.read(key: 'admin_public_key');
    if (adminKey == null || adminKey.isEmpty) {
      _showSnack('Admin key not configured. Set admin_public_key in secure storage.');
      return;
    }

    final svc = context.read<FreezeService>();

    // 3. Build unsigned XDR
    final xdr = await svc.buildFreezeXdr(
      assetCode: p.assetCode,
      issuer: p.issuer,
      target: p.target,
      adminKey: adminKey,
    );
    if (xdr == null) { _showSnack('Failed to build transaction'); return; }

    // 4. Sign the XDR with the admin's private key.
    //    In production: integrate a mobile Stellar wallet SDK (e.g. stellar_flutter_sdk)
    //    to sign with the key stored in secure storage.
    //    The XDR MUST be signed before submission — submitting unsigned XDR
    //    will be rejected by the network with tx_bad_auth.
    final signedXdr = await _signXdr(xdr, adminKey);
    if (signedXdr == null) {
      _showSnack('Signing not yet integrated. Connect a Stellar wallet SDK to sign.');
      return;
    }

    // 5. Submit signed XDR
    final result = await svc.submitSignedVote(
      signedXdr: signedXdr,
      assetCode: p.assetCode,
      issuer: p.issuer,
      target: p.target,
    );

    _showSnack(result.ok ? '✅ Vote submitted' : '❌ ${result.error}');
    if (result.ok) svc.fetchProposals();
  }

  /// Sign XDR with the admin's private key.
  /// TODO: integrate stellar_flutter_sdk or equivalent wallet SDK.
  /// Returns null (with a clear error shown to the user) until implemented.
  Future<String?> _signXdr(String unsignedXdr, String adminPublicKey) async {
    // Retrieve the secret key from secure storage (never hardcode it).
    final secretKey = await _storage.read(key: 'admin_secret_key');
    if (secretKey == null) return null;

    // TODO: use stellar_flutter_sdk KeyPair to sign:
    // final kp = KeyPair.fromSecretSeed(secretKey);
    // final tx = AbstractTransaction.fromEnvelopeXdr(unsignedXdr);
    // tx.sign(kp, Network.TESTNET);
    // return tx.toEnvelopeXdrBase64();
    return null; // Remove this line once SDK is integrated
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<FreezeService>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('⚡ Stellar-Guard Alerts'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: svc.fetchProposals),
        ],
      ),
      body: svc.loading
          ? const Center(child: CircularProgressIndicator())
          : svc.error != null
              ? Center(child: Text('Error: ${svc.error}', style: const TextStyle(color: Colors.red)))
              : svc.proposals.isEmpty
                  ? const Center(child: Text('No pending freeze proposals'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: svc.proposals.length,
                      itemBuilder: (_, i) => _ProposalCard(
                        proposal: svc.proposals[i],
                        onApprove: () => _approveWithBiometrics(svc.proposals[i]),
                      ),
                    ),
    );
  }
}

class _ProposalCard extends StatelessWidget {
  final FreezeProposal proposal;
  final VoidCallback onApprove;

  const _ProposalCard({required this.proposal, required this.onApprove});

  @override
  Widget build(BuildContext context) {
    final shortTarget = proposal.target.length > 12
        ? '${proposal.target.substring(0, 12)}…'
        : proposal.target;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.lock_outline, color: Color(0xFFDC2626)),
            const SizedBox(width: 8),
            Text(proposal.assetCode,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const Spacer(),
            Chip(label: Text('${proposal.votes}/3 votes')),
          ]),
          const SizedBox(height: 8),
          Text('Target: $shortTarget',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onApprove,
              icon: const Icon(Icons.fingerprint),
              label: const Text('Approve with Biometrics'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            ),
          ),
        ]),
      ),
    );
  }
}
