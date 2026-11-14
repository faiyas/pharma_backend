import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/attendance_provider.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final att = context.read<AttendanceProvider>();
      att.fetchHistory();
      att.fetchMyEvidence();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final timeFmt = DateFormat('hh:mm a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Attendance & Evidence'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.list_alt), text: 'Punch Logs'),
            Tab(icon: Icon(Icons.photo_camera_front), text: 'Selfie Evidence'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              att.fetchHistory();
              att.fetchMyEvidence();
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Punch Records
          att.history.isEmpty
              ? const Center(
                  child: Text(
                    'No attendance records found.',
                    style: TextStyle(color: AppTheme.textMuted),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await att.fetchHistory();
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: att.history.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final r = att.history[i];
                      final inStr = r.checkIn != null ? timeFmt.format(r.checkIn!) : '—';
                      final outStr = r.checkOut != null ? timeFmt.format(r.checkOut!) : '—';

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    r.workDate,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      r.status,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.primaryDark,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                r.shopName,
                                style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                              ),
                              const Divider(height: 18),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.login, size: 16, color: AppTheme.success),
                                      const SizedBox(width: 4),
                                      Text('In: $inStr', style: const TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                  Row(
                                    children: [
                                      const Icon(Icons.logout, size: 16, color: AppTheme.accent),
                                      const SizedBox(width: 4),
                                      Text('Out: $outStr', style: const TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ],
                              ),
                              if (r.reviewStatus != 'NONE') ...[
                                const SizedBox(height: 8),
                                Text(
                                  'Review: ${r.reviewStatus}',
                                  style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppTheme.warning),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

          // Tab 2: Selfie Evidence
          att.myEvidence.isEmpty
              ? const Center(
                  child: Text(
                    'No photo evidence captured yet.',
                    style: TextStyle(color: AppTheme.textMuted),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await att.fetchMyEvidence();
                  },
                  child: GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.78,
                    ),
                    itemCount: att.myEvidence.length,
                    itemBuilder: (ctx, i) {
                      final ev = att.myEvidence[i];
                      return Card(
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(
                              child: ev.photoUrl != null && ev.photoUrl!.isNotEmpty
                                  ? Image.network(
                                      ev.photoUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        color: Colors.grey.shade200,
                                        child: const Icon(Icons.person, size: 40, color: AppTheme.textMuted),
                                      ),
                                    )
                                  : Container(
                                      color: Colors.grey.shade200,
                                      child: const Icon(Icons.image_not_supported, color: AppTheme.textMuted),
                                    ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        ev.eventType,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                          color: ev.eventType == 'CHECK_IN' ? AppTheme.success : AppTheme.accent,
                                        ),
                                      ),
                                      Icon(
                                        ev.accepted ? Icons.verified : Icons.warning_amber,
                                        size: 14,
                                        color: ev.accepted ? AppTheme.success : AppTheme.warning,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    ev.timestamp.length >= 16 ? ev.timestamp.substring(0, 16) : ev.timestamp,
                                    style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                  ),
                                  if (ev.distanceM != null)
                                    Text(
                                      '${ev.distanceM!.toStringAsFixed(0)}m from store',
                                      style: const TextStyle(fontSize: 10, color: AppTheme.primaryDark),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ],
      ),
    );
  }
}
