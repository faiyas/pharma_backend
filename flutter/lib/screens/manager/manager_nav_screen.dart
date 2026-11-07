import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/leave_provider.dart';
import '../../providers/manager_provider.dart';
import '../auth/login_screen.dart';
import 'manager_account_screen.dart';
import 'manager_analytics_screen.dart';
import 'manager_approvals_screen.dart';
import 'manager_attendance_screen.dart';
import 'manager_branches_screen.dart';
import 'manager_dashboard_screen.dart';
import 'manager_employees_screen.dart';
import 'manager_monitoring_screen.dart';

class ManagerNavScreen extends StatefulWidget {
  const ManagerNavScreen({super.key});

  @override
  State<ManagerNavScreen> createState() => _ManagerNavScreenState();
}

class _ManagerNavScreenState extends State<ManagerNavScreen> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    ManagerDashboardScreen(),
    ManagerAttendanceScreen(),
    ManagerEmployeesScreen(),
    ManagerApprovalsScreen(),
  ];

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out from the manager portal?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<AuthProvider>().logout();
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
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
    final mgr = context.watch<ManagerProvider>();
    final leaveProv = context.watch<LeaveProvider>();

    final pendingCount =
        mgr.pendingAttendanceReviews.length +
        mgr.pendingCorrections.length +
        leaveProv.pendingLeaves.length;

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
                  (user?.fullName?.isNotEmpty == true ? user!.fullName![0] : 'M').toUpperCase(),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                ),
              ),
              accountName: Text(
                user?.fullName ?? user?.username ?? 'Manager',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              accountEmail: Text(
                user?.role == 'SUPER_ADMIN' ? 'Super Administrator' : 'Branch Manager',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined, color: AppTheme.primary),
              title: const Text('Dashboard'),
              selected: _currentIndex == 0,
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 0);
              },
            ),
            ListTile(
              leading: const Icon(Icons.storefront_outlined, color: AppTheme.primary),
              title: const Text('My Branches & Geofences'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ManagerBranchesScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.people_outline, color: AppTheme.primary),
              title: const Text('Staff Directory & Lifecycle'),
              selected: _currentIndex == 2,
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 2);
              },
            ),
            ListTile(
              leading: const Icon(Icons.fact_check_outlined, color: AppTheme.primary),
              title: const Text('Workforce Attendance Logs'),
              selected: _currentIndex == 1,
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 1);
              },
            ),
            ListTile(
              leading: const Icon(Icons.task_alt, color: AppTheme.warning),
              title: const Text('Approvals Hub'),
              trailing: pendingCount > 0
                  ? Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.danger,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$pendingCount',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    )
                  : null,
              selected: _currentIndex == 3,
              onTap: () {
                Navigator.pop(context);
                setState(() => _currentIndex = 3);
              },
            ),
            ListTile(
              leading: const Icon(Icons.sensors, color: Colors.deepPurple),
              title: const Text('Live Monitoring & Activity'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ManagerMonitoringScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.bar_chart, color: Colors.teal),
              title: const Text('Attendance Analytics'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ManagerAnalyticsScreen()));
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined, color: AppTheme.textMuted),
              title: const Text('Account & Security'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ManagerAccountScreen()));
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: AppTheme.danger),
              title: const Text('Sign Out', style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold)),
              onTap: () {
                Navigator.pop(context);
                _confirmLogout();
              },
            ),
          ],
        ),
      ),
      body: _pages[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: AppTheme.textMuted,
        selectedFontSize: 12,
        unselectedFontSize: 12,
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.fact_check_outlined),
            activeIcon: Icon(Icons.fact_check),
            label: 'Attendance',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: 'Employees',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: pendingCount > 0,
              label: Text('$pendingCount'),
              child: const Icon(Icons.task_alt),
            ),
            label: 'Approvals',
          ),
        ],
      ),
    );
  }
}
