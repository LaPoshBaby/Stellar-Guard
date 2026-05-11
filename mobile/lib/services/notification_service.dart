import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  static Future<void> init() async {
    await Firebase.initializeApp();
    final messaging = FirebaseMessaging.instance;

    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage msg) {
      // Handled by AlertScreen via stream
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
