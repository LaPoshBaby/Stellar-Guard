import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/alert_screen.dart';
import 'services/freeze_service.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.init();
  runApp(
    ChangeNotifierProvider(
      create: (_) => FreezeService(),
      child: const StellarGuardApp(),
    ),
  );
}

class StellarGuardApp extends StatelessWidget {
  const StellarGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Stellar-Guard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF7C3AED),
          error: const Color(0xFFDC2626),
          surface: const Color(0xFF111827),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0E1A),
        useMaterial3: true,
      ),
      home: const AlertScreen(),
    );
  }
}
