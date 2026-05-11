import 'package:flutter/material.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FreezeService>().fetchProposals();
    });
  }

  Future<void> _approveWithBiometrics(FreezeProposal p) async {
    final canAuth = await _auth.canCheckBiometrics;
    if (!canAuth) {
      _showSnack('Biometrics not available');
      return;
    }
    final authenticated = await _auth.authenticate(
      localizedReason: 'Authenticate to approve freeze of ${p.assetCode}',
      options: const AuthenticationOptions(biometricOnly: true),
    );
    if (!authenticated) return;

    // TODO: load admin key from secure storage
    const adminKey = 'REPLACE_WITH_ADMIN_PUBLIC_KEY';
    final ok = await context.read<FreezeService>().approveFreeze(
          assetCode: p.assetCode,
          issuer: p.issuer,
          target: p.target,
          adminKey: adminKey,
        );
    _showSnack(ok ? '✅ Vote submitted' : '❌ Submission failed');
    if (ok) context.read<FreezeService>().fetchProposals();
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
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: svc.fetchProposals,
          )
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
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.lock_outline, color: Color(0xFFDC2626)),
            const SizedBox(width: 8),
            Text(proposal.assetCode, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const Spacer(),
            Chip(label: Text('${proposal.votes}/3 votes')),
          ]),
          const SizedBox(height: 8),
          Text('Target: ${proposal.target.length > 12 ? '${proposal.target.substring(0, 12)}…' : proposal.target}', style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
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
