import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/freeze_service.dart';

class ProposalDetailScreen extends StatelessWidget {
  final FreezeProposal proposal;
  final VoidCallback onApprove;

  const ProposalDetailScreen({
    super.key,
    required this.proposal,
    required this.onApprove,
  });

  void _copy(BuildContext context, String value) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied to clipboard'), duration: Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${proposal.assetCode} Proposal')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AddressRow(label: 'Asset', value: proposal.assetCode, onCopy: () => _copy(context, proposal.assetCode)),
            const SizedBox(height: 16),
            _AddressRow(label: 'Issuer', value: proposal.issuer, onCopy: () => _copy(context, proposal.issuer)),
            const SizedBox(height: 16),
            _AddressRow(label: 'Target', value: proposal.target, onCopy: () => _copy(context, proposal.target)),
            const SizedBox(height: 24),
            Chip(label: Text('${proposal.votes}/3 votes')),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  onApprove();
                },
                icon: const Icon(Icons.fingerprint),
                label: const Text('Approve with Biometrics'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onCopy;

  const _AddressRow({required this.label, required this.value, required this.onCopy});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: Text(
                value,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.copy, size: 18),
              onPressed: onCopy,
              tooltip: 'Copy $label',
            ),
          ],
        ),
      ],
    );
  }
}
