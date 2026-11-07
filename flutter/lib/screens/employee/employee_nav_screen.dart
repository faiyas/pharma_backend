import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
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

    return Scaffold(
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: AppTheme.primary),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  (user?.fullName?.isNotEmpty == true ? user!.fullName![0] : 'U').toUpperCase(),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primary),
                ),
              ),
              accountName: Text(user?.fullName ?? user?.username ?? 'Employee', style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text(user?.employeeCode != null ? 'Staff ID: ${user!.employeeCode}' : user?.email ?? ''),
            ),
            ListTile(
              leading: const Icon(Icons.storefront, color: AppTheme.primary),
              title: Text(user?.assignedShop?.name ?? 'Assigned Pharmacy'),
              subtitle: Text(user?.assignedShop?.address ?? 'Branch'),
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
      body: _pages[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: AppTheme.textMuted,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.fingerprint), label: 'Punch'),
          BottomNavigationBarItem(icon: Icon(Icons.event_note), label: 'Leaves'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
        ],
      ),
    );
  }
}

