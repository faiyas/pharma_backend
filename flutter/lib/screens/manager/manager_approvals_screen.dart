import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/correction_model.dart';
import '../../providers/leave_provider.dart';
import '../../providers/manager_provider.dart';

class ManagerApprovalsScreen extends StatefulWidget {
  const ManagerApprovalsScreen({super.key});

  @override
  State<ManagerApprovalsScreen> createState() => _ManagerApprovalsScreenState();
}

class _ManagerApprovalsScreenState extends State<ManagerApprovalsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LeaveProvider>().fetchLeaves();
      final mgr = context.read<ManagerProvider>();
      mgr.fetchPendingAttendanceReviews();
      mgr.fetchCorrections();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showActionDialog({
    required String title,
    required String actionLabel,
    required Color actionColor,
    required Future<bool> Function(String comments) onConfirm,
  }) {
    final commentsController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Manager Comments / Reason:', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
            const SizedBox(height: 8),
            TextField(
              controller: commentsController,
              maxLines: 2,
              decoration: const InputDecoration(hintText: 'Enter approval notes or rejection reason...'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: actionColor),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await onConfirm(commentsController.text.trim());
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? '$actionLabel successful!' : 'Action failed.'),
                    backgroundColor: success ? AppTheme.success : AppTheme.danger,
                  ),
                );
              }
            },
            child: Text(actionLabel),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final leaveProv = context.watch<LeaveProvider>();
    final mgr = context.watch<ManagerProvider>();

    final pendingLeaves = leaveProv.pendingLeaves;
    final pendingReviews = mgr.pendingAttendanceReviews;
    final pendingCorrections = mgr.pendingCorrections;
    final timeFmt = DateFormat('hh:mm a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Approvals Hub'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              leaveProv.fetchLeaves();
              mgr.fetchPendingAttendanceReviews();
              mgr.fetchCorrections();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textMuted,
          indicatorColor: AppTheme.primary,
          tabs: [
            Tab(text: 'Leaves (${pendingLeaves.length})'),
            Tab(text: 'Punches (${pendingReviews.length})'),
            Tab(text: 'Corrections (${pendingCorrections.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Leaves
          pendingLeaves.isEmpty
              ? const Center(child: Text('No pending leave applications.', style: TextStyle(color: AppTheme.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: pendingLeaves.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, i) {
                    final l = pendingLeaves[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(l.employeeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.warning.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    l.leaveType,
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.warning),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text('${l.employeeCode} • ${l.startDate} to ${l.endDate} (${l.totalDays} day${l.totalDays > 1 ? "s" : ""})',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            if (l.reason.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text('Reason: ${l.reason}', style: const TextStyle(fontSize: 13, fontStyle: FontStyle.italic)),
                            ],
                            const SizedBox(height: 14),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.danger,
                                    side: const BorderSide(color: AppTheme.danger),
                                  ),
                                  onPressed: () => _showActionDialog(
                                    title: 'Reject Leave Request',
                                    actionLabel: 'Reject',
                                    actionColor: AppTheme.danger,
                                    onConfirm: (comments) => leaveProv.rejectLeave(l.id, comments: comments),
                                  ),
                                  child: const Text('Reject'),
                                ),
                                const SizedBox(width: 10),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                                  onPressed: () => _showActionDialog(
                                    title: 'Approve Leave Request',
                                    actionLabel: 'Approve',
                                    actionColor: AppTheme.success,
                                    onConfirm: (comments) => leaveProv.approveLeave(l.id, comments: comments),
                                  ),
                                  child: const Text('Approve'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

          // Tab 2: Attendance Reviews
          pendingReviews.isEmpty
              ? const Center(child: Text('No pending attendance reviews.', style: TextStyle(color: AppTheme.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: pendingReviews.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, i) {
                    final a = pendingReviews[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(a.employeeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.warning.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'Needs Review',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.warning),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text('${a.employeeCode} • ${a.shopName} • ${a.workDate}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            const SizedBox(height: 8),
                            Text(
                              'Check-In: ${a.checkIn != null ? timeFmt.format(a.checkIn!) : "—"} | Check-Out: ${a.checkOut != null ? timeFmt.format(a.checkOut!) : "Working"}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            if (a.distanceM != null) ...[
                              const SizedBox(height: 4),
                              Text('GPS Distance from shop: ${a.distanceM!.toStringAsFixed(1)}m',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            ],
                            const SizedBox(height: 14),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.danger,
                                    side: const BorderSide(color: AppTheme.danger),
                                  ),
                                  onPressed: () => _showActionDialog(
                                    title: 'Reject Attendance Record',
                                    actionLabel: 'Reject',
                                    actionColor: AppTheme.danger,
                                    onConfirm: (comments) => mgr.rejectAttendance(a.id, comments: comments),
                                  ),
                                  child: const Text('Reject'),
                                ),
                                const SizedBox(width: 10),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                                  onPressed: () => _showActionDialog(
                                    title: 'Accept Attendance Record',
                                    actionLabel: 'Accept',
                                    actionColor: AppTheme.success,
                                    onConfirm: (comments) => mgr.approveAttendance(a.id, comments: comments),
                                  ),
                                  child: const Text('Accept'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

          // Tab 3: Corrections
          pendingCorrections.isEmpty
              ? const Center(child: Text('No pending attendance corrections.', style: TextStyle(color: AppTheme.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: pendingCorrections.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (ctx, i) {
                    final CorrectionModel c = pendingCorrections[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(c.employeeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.accent.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    c.eventType,
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.accent),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text('${c.employeeCode} • ${c.shopName} • Date: ${c.attendanceDate}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            const SizedBox(height: 8),
                            Text(
                              'Requested Time: ${timeFmt.format(c.requestedTimestamp)}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                            ),
                            if (c.originalTimestamp != null)
                              Text('Original Time: ${timeFmt.format(c.originalTimestamp!)}',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            if (c.reason.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text('Reason: ${c.reason}', style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
                            ],
                            const SizedBox(height: 14),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.danger,
                                    side: const BorderSide(color: AppTheme.danger),
                                  ),
                                  onPressed: () => _showActionDialog(
                                    title: 'Reject Correction Request',
                                    actionLabel: 'Reject',
                                    actionColor: AppTheme.danger,
                                    onConfirm: (comments) => mgr.rejectCorrection(c.id, comments: comments),
                                  ),
                                  child: const Text('Reject'),
                                ),
                                const SizedBox(width: 10),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                                  onPressed: () => _showActionDialog(
                                    title: 'Approve Correction Request',
                                    actionLabel: 'Approve',
                                    actionColor: AppTheme.success,
                                    onConfirm: (comments) => mgr.approveCorrection(c.id, comments: comments),
                                  ),
                                  child: const Text('Approve'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ],
      ),
    );
  }
}
