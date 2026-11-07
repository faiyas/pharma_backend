import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/leave_provider.dart';
import '../../providers/manager_provider.dart';
import 'manager_analytics_screen.dart';
import 'manager_approvals_screen.dart';
import 'manager_attendance_screen.dart';
import 'manager_branches_screen.dart';
import 'manager_employees_screen.dart';
import 'manager_monitoring_screen.dart';

class ManagerDashboardScreen extends StatefulWidget {
  const ManagerDashboardScreen({super.key});

  @override
  State<ManagerDashboardScreen> createState() => _ManagerDashboardScreenState();
}

class _ManagerDashboardScreenState extends State<ManagerDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    context.read<ManagerProvider>().fetchDashboardData();
    context.read<LeaveProvider>().fetchLeaves();
  }

  Widget _buildKpiCard(String label, String value, IconData icon, Color color, {String? sub}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w600),
                ),
                Icon(icon, size: 20, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
            ),
            if (sub != null) ...[
              const SizedBox(height: 4),
              Text(sub, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHubTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    int? badgeCount,
    required VoidCallback onTap,
  }) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  if (badgeCount != null && badgeCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.danger,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final user = context.watch<AuthProvider>().currentUser;
    final leaveProv = context.watch<LeaveProvider>();
    final summary = mgr.summary;

    final pendingApprovalsCount =
        mgr.pendingAttendanceReviews.length +
        mgr.pendingCorrections.length +
        leaveProv.pendingLeaves.length;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Manager Portal', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            Text(
              user?.role == 'SUPER_ADMIN' ? 'Super Administrator' : 'Branch Manager',
              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh All Data',
            onPressed: _loadData,
          ),
        ],
      ),
      body: mgr.isLoading && summary == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async => _loadData(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Overview Banner
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.primaryDark, AppTheme.primary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Hello, ${user?.fullName ?? user?.username ?? "Manager"}!',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${summary?.presentCount ?? 0} staff present today across ${mgr.branches.length} branches.',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.85),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.sensors, color: Colors.white, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${summary?.currentlyWorking ?? 0} Active',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // KPI Metrics Grid
                    const Text(
                      'Workforce Overview',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildKpiCard(
                            'Total Staff',
                            summary?.totalEmployees.toString() ?? '0',
                            Icons.people_outline,
                            AppTheme.primary,
                            sub: 'Active employees',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildKpiCard(
                            'Present Today',
                            summary?.presentCount.toString() ?? '0',
                            Icons.how_to_reg_outlined,
                            AppTheme.success,
                            sub: '${summary?.currentlyWorking ?? 0} currently working',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildKpiCard(
                            'On Leave',
                            summary?.onLeaveCount.toString() ?? '0',
                            Icons.event_busy_outlined,
                            AppTheme.warning,
                            sub: 'Approved leaves today',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildKpiCard(
                            'Late Arrivals',
                            summary?.lateArrivals.toString() ?? '0',
                            Icons.alarm_on_outlined,
                            AppTheme.danger,
                            sub: 'Past 09:30 AM',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Management Hub
                    const Text(
                      'Management Hub',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      children: [
                        _buildHubTile(
                          title: 'My Branches',
                          subtitle: '${mgr.branches.length} branches • Geofences',
                          icon: Icons.storefront,
                          color: AppTheme.primary,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerBranchesScreen()),
                          ),
                        ),
                        _buildHubTile(
                          title: 'Employees',
                          subtitle: 'Directory & branch transfer',
                          icon: Icons.badge_outlined,
                          color: AppTheme.accent,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerEmployeesScreen()),
                          ),
                        ),
                        _buildHubTile(
                          title: 'Attendance',
                          subtitle: 'Workforce records & logs',
                          icon: Icons.fact_check_outlined,
                          color: AppTheme.success,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerAttendanceScreen()),
                          ),
                        ),
                        _buildHubTile(
                          title: 'Approvals Hub',
                          subtitle: 'Leaves & corrections',
                          icon: Icons.task_alt,
                          color: AppTheme.warning,
                          badgeCount: pendingApprovalsCount,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerApprovalsScreen()),
                          ),
                        ),
                        _buildHubTile(
                          title: 'Live Monitoring',
                          subtitle: 'Real-time punch feed',
                          icon: Icons.sensors,
                          color: Colors.deepPurple,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerMonitoringScreen()),
                          ),
                        ),
                        _buildHubTile(
                          title: 'Analytics',
                          subtitle: 'Punctuality & shift stats',
                          icon: Icons.bar_chart,
                          color: Colors.teal,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerAnalyticsScreen()),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Managed Branches Mini-List
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Branches Overview',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        TextButton(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ManagerBranchesScreen()),
                          ),
                          child: const Text('View All', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    if (mgr.branches.isEmpty)
                      const Text('No branches assigned.', style: TextStyle(color: AppTheme.textMuted))
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: mgr.branches.take(3).length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, i) {
                          final b = mgr.branches[i];
                          return Card(
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.storefront, color: AppTheme.primary),
                              ),
                              title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              subtitle: Text('${b.code} • ${b.allowedRadiusM.toStringAsFixed(0)}m Geofence', style: const TextStyle(fontSize: 12)),
                              trailing: const Icon(Icons.chevron_right, size: 18, color: AppTheme.textMuted),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const ManagerBranchesScreen()),
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
    );
  }
}
