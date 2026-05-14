import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static final navigatorKey = GlobalKey<NavigatorState>();

  static Future<void> init() async {
    await Firebase.initializeApp();
    final messaging = FirebaseMessaging.instance;

    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Subscribe to the freeze_alerts topic so all admin devices receive proposals
    await messaging.subscribeToTopic('freeze_alerts');

    // Foreground: show snackbar and navigate to AlertScreen
    FirebaseMessaging.onMessage.listen((RemoteMessage msg) {
      final assetCode = msg.data['assetCode'] ?? '';
      final target = msg.data['target'] ?? '';
      navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (r) => false);
      final ctx = navigatorKey.currentContext;
      if (ctx != null) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(
            content: Text('⚡ New freeze proposal: $assetCode — ${target.length > 12 ? '${target.substring(0, 12)}…' : target}'),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    });

    // Tapped notification from background/terminated state → navigate to AlertScreen
    FirebaseMessaging.onMessageOpenedApp.listen((_) {
      navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (r) => false);
    });

    // Background handler must be top-level
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
  }

  static Future<String?> getToken() => FirebaseMessaging.instance.getToken();
}

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background freeze alert received — app will show on next open
}
