import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/manager_provider.dart';

class ManagerAnalyticsScreen extends StatefulWidget {
  const ManagerAnalyticsScreen({super.key});

  @override
  State<ManagerAnalyticsScreen> createState() => _ManagerAnalyticsScreenState();
}

class _ManagerAnalyticsScreenState extends State<ManagerAnalyticsScreen> {
  int? _selectedShopId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mgr = context.read<ManagerProvider>();
      mgr.fetchBranches();
      mgr.fetchAnalytics();
    });
  }

  void _refresh() {
    context.read<ManagerProvider>().fetchAnalytics(shopId: _selectedShopId);
  }

  Widget _statCard(String label, String value, IconData icon, Color color, {String? sub}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w600)),
                Icon(icon, size: 20, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            if (sub != null) ...[
              const SizedBox(height: 4),
              Text(sub, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final a = mgr.analytics;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
        ],
      ),
      body: mgr.isLoading && a == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Branch Selector
                    if (mgr.branches.isNotEmpty) ...[
                      Row(
                        children: [
                          const Icon(Icons.storefront, size: 18, color: AppTheme.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: DropdownButton<int?>(
                              value: _selectedShopId,
                              isExpanded: true,
                              hint: const Text('All Accessible Branches'),
                              items: [
                                const DropdownMenuItem<int?>(
                                  value: null,
                                  child: Text('All Branches Combined'),
                                ),
                                ...mgr.branches.map(
                                  (b) => DropdownMenuItem<int?>(
                                    value: b.id,
                                    child: Text(b.name),
                                  ),
                                ),
                              ],
                              onChanged: (val) {
                                setState(() => _selectedShopId = val);
                                _refresh();
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Top Rate Row
                    Row(
                      children: [
                        Expanded(
                          child: _statCard(
                            'Attendance Rate',
                            '${a?.attendancePercentage.toStringAsFixed(1) ?? "0"}%',
                            Icons.check_circle_outline,
                            AppTheme.success,
                            sub: '${a?.totalPresentDays ?? 0} present days',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _statCard(
                            'Punctuality Rate',
                            '${a?.punctualityRate.toStringAsFixed(1) ?? "0"}%',
                            Icons.timer_outlined,
                            AppTheme.primary,
                            sub: '${a?.lateCount ?? 0} late arrivals',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Hours Row
                    Row(
                      children: [
                        Expanded(
                          child: _statCard(
                            'Avg Working Shift',
                            '${a?.avgWorkingHours.toStringAsFixed(1) ?? "0"}h',
                            Icons.hourglass_bottom,
                            AppTheme.textMain,
                            sub: '${a?.totalHours.toStringAsFixed(0) ?? "0"} total hours',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _statCard(
                            'Overtime Hours',
                            '${a?.overtimeHours.toStringAsFixed(1) ?? "0"}h',
                            Icons.trending_up,
                            AppTheme.accent,
                            sub: '> 8h daily shifts',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Attention Row
                    Row(
                      children: [
                        Expanded(
                          child: _statCard(
                            'Late Arrivals',
                            a?.lateCount.toString() ?? '0',
                            Icons.alarm_on_outlined,
                            AppTheme.warning,
                            sub: 'Punched past 09:30 AM',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _statCard(
                            'Missing Checkouts',
                            a?.missingCheckoutCount.toString() ?? '0',
                            Icons.warning_amber_rounded,
                            AppTheme.danger,
                            sub: 'Requires correction',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Leave Requests Statistics Breakdown
                    const Text(
                      'Leave Requests Distribution',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          children: [
                            _breakdownRow('Total Requests', a?.leaveStats['total_requests']?.toString() ?? '0'),
                            const Divider(height: 16),
                            _breakdownRow('Approved Leaves', a?.leaveStats['approved']?.toString() ?? '0', color: AppTheme.success),
                            const Divider(height: 16),
                            _breakdownRow('Pending Leaves', a?.leaveStats['pending']?.toString() ?? '0', color: AppTheme.warning),
                            const Divider(height: 16),
                            _breakdownRow('Rejected Leaves', a?.leaveStats['rejected']?.toString() ?? '0', color: AppTheme.danger),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _breakdownRow(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
        Text(
          value,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color ?? AppTheme.textMain),
        ),
      ],
    );
  }
}

