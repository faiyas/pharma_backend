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

class _HistoryScreenState extends State<HistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AttendanceProvider>().fetchHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final timeFmt = DateFormat('hh:mm a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => att.fetchHistory(),
          ),
        ],
      ),
      body: att.history.isEmpty
          ? const Center(
              child: Text(
                'No attendance records found.',
                style: TextStyle(color: AppTheme.textMuted),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => att.fetchHistory(),
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
    );
  }
}

