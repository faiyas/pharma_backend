import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'providers/attendance_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/leave_provider.dart';
import 'providers/manager_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/employee/employee_nav_screen.dart';
import 'screens/manager/manager_nav_screen.dart';
import 'services/storage_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables from .env
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // Falls back to default live backend URL in ApiConstants
  }

  // Initialize storage service
  await StorageService.init();

  runApp(const PharmaTrackApp());
}

class PharmaTrackApp extends StatelessWidget {
  const PharmaTrackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..checkAuth()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ChangeNotifierProvider(create: (_) => LeaveProvider()),
        ChangeNotifierProvider(create: (_) => ManagerProvider()),
      ],
      child: MaterialApp(
        title: 'PharmaTrack',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AppRootRouter(),
      ),
    );
  }
}

class AppRootRouter extends StatelessWidget {
  const AppRootRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.isInitialized) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Starting PharmaTrack...',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    if (auth.isAuthenticated) {
      final user = auth.currentUser;
      if (user != null && (user.isManager || user.isAdmin)) {
        return const ManagerNavScreen();
      }
      return const EmployeeNavScreen();
    }

    return const LoginScreen();
  }
}
