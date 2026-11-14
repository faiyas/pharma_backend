import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'corrections_screen.dart';
import 'employee_profile_screen.dart';
import 'history_screen.dart';
import 'leaves_screen.dart';
import 'punch_screen.dart';

class EmployeeNavScreen extends StatefulWidget {
  const EmployeeNavScreen({super.key});

  @override
  State<EmployeeNavScreen> createState() => _EmployeeNavScreenState();
}

class _EmployeeNavScreenState extends State<EmployeeNavScreen> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    PunchScreen(),
    LeavesScreen(),
    HistoryScreen(),
    CorrectionsScreen(),
  ];

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<AuthProvider>().logout();
              if (mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final needsSetup = user?.mustChangePassword == true;

    return Scaffold(
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primaryDark, AppTheme.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  (user?.fullName?.isNotEmpty == true ? user!.fullName![0] : 'U').toUpperCase(),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                ),
              ),
              accountName: Text(user?.fullName ?? user?.username ?? 'Employee', style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text(user?.employeeCode != null ? 'Staff ID: ${user!.employeeCode}' : user?.email ?? ''),
            ),
            if (needsSetup)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.warning),
                ),
                child: InkWell(
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const EmployeeProfileScreen(isFirstTimeSetup: true)),
                    );
                  },
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Setup Required: Tap to activate your profile & set password.',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ListTile(
              leading: const Icon(Icons.storefront, color: AppTheme.primary),
              title: Text(user?.assignedShop?.name ?? 'Assigned Pharmacy'),
              subtitle: Text(user?.assignedShop?.address ?? 'Branch'),
            ),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined, color: AppTheme.primary),
              title: const Text('My Profile & Password'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const EmployeeProfileScreen()),
                );
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: AppTheme.danger),
              title: const Text('Sign Out', style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.w600)),
              onTap: _confirmLogout,
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          if (needsSetup)
            MaterialBanner(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              content: const Text(
                'Account Setup: Please complete your profile details and set a personal password.',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              leading: const Icon(Icons.shield_outlined, color: AppTheme.warning),
              backgroundColor: AppTheme.warning.withValues(alpha: 0.15),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const EmployeeProfileScreen(isFirstTimeSetup: true)),
                    );
                  },
                  child: const Text('Set Up Now', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          Expanded(child: _pages[_currentIndex]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: AppTheme.textMuted,
        type: BottomNavigationBarType.fixed,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.fingerprint), label: 'Punch'),
          BottomNavigationBarItem(icon: Icon(Icons.event_note), label: 'Leaves'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
          BottomNavigationBarItem(icon: Icon(Icons.edit_calendar), label: 'Corrections'),
        ],
      ),
    );
  }
}
