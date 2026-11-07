import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/attendance_model.dart';
import '../../providers/manager_provider.dart';

class ManagerAttendanceScreen extends StatefulWidget {
  const ManagerAttendanceScreen({super.key});

  @override
  State<ManagerAttendanceScreen> createState() => _ManagerAttendanceScreenState();
}

class _ManagerAttendanceScreenState extends State<ManagerAttendanceScreen> {
  String _selectedStatus = 'ALL';
  DateTime? _selectedDate;
  int? _selectedShopId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mgr = context.read<ManagerProvider>();
      mgr.fetchBranches();
      mgr.fetchAttendanceRecords();
    });
  }

  void _fetchFiltered() {
    final dateStr = _selectedDate != null ? DateFormat('yyyy-MM-dd').format(_selectedDate!) : null;
    context.read<ManagerProvider>().fetchAttendanceRecords(
      date: dateStr,
      shopId: _selectedShopId,
      status: _selectedStatus,
    );
  }

  void _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2025),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _fetchFiltered();
    }
  }

  void _showApprovalDialog(AttendanceRecordModel record, bool isApprove) {
    final commentsController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${isApprove ? "Approve" : "Reject"} Attendance?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Employee: ${record.employeeName} (${record.employeeCode})'),
            Text('Date: ${record.workDate}'),
            const SizedBox(height: 12),
            TextField(
              controller: commentsController,
              decoration: const InputDecoration(hintText: 'Manager comments / notes...'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isApprove ? AppTheme.success : AppTheme.danger,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final mgr = context.read<ManagerProvider>();
              final success = isApprove
                  ? await mgr.approveAttendance(record.id, comments: commentsController.text.trim())
                  : await mgr.rejectAttendance(record.id, comments: commentsController.text.trim());
              if (mounted) {
                _fetchFiltered();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Attendance status updated.' : 'Action failed.'),
                    backgroundColor: success ? AppTheme.success : AppTheme.danger,
                  ),
                );
              }
            },
            child: Text(isApprove ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final records = mgr.attendanceRecords;
    final timeFmt = DateFormat('hh:mm a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Workforce Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchFiltered,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.calendar_month, size: 16),
                    label: Text(
                      _selectedDate == null ? 'All Dates' : DateFormat('dd MMM yyyy').format(_selectedDate!),
                      style: const TextStyle(fontSize: 12),
                    ),
                    onPressed: _pickDate,
                  ),
                ),
                if (_selectedDate != null)
                  IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () {
                      setState(() => _selectedDate = null);
                      _fetchFiltered();
                    },
                  ),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _selectedStatus,
                  underline: const SizedBox(),
                  style: const TextStyle(fontSize: 13, color: AppTheme.textMain, fontWeight: FontWeight.w600),
                  items: const [
                    DropdownMenuItem(value: 'ALL', child: Text('All Status')),
                    DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                    DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
                    DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _selectedStatus = val);
                      _fetchFiltered();
                    }
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Attendance Records List
          Expanded(
            child: mgr.isLoading && records.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : records.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.event_note, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            const Text('No attendance records found.', style: TextStyle(color: AppTheme.textMuted)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async => _fetchFiltered(),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: records.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (ctx, i) {
                            final r = records[i];
                            final isPending = r.reviewStatus == 'PENDING' || r.reviewStatus == 'PENDING_REVIEW' || r.status == 'PENDING';

                            Color statusColor = AppTheme.success;
                            if (r.status == 'PENDING') statusColor = AppTheme.warning;
                            if (r.status == 'REJECTED') statusColor = AppTheme.danger;

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
                                          r.employeeName,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: statusColor.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            r.status,
                                            style: TextStyle(
                                              color: statusColor,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${r.employeeCode} • ${r.shopName} • ${r.workDate}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: _timeBox(
                                            'Check-In',
                                            r.checkIn != null ? timeFmt.format(r.checkIn!) : '—',
                                            Icons.login,
                                            AppTheme.primary,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: _timeBox(
                                            'Check-Out',
                                            r.checkOut != null ? timeFmt.format(r.checkOut!) : 'Working',
                                            Icons.logout,
                                            r.checkOut != null ? AppTheme.accent : AppTheme.warning,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (isPending) ...[
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          OutlinedButton(
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppTheme.danger,
                                              side: const BorderSide(color: AppTheme.danger),
                                              padding: const EdgeInsets.symmetric(horizontal: 14),
                                            ),
                                            onPressed: () => _showApprovalDialog(r, false),
                                            child: const Text('Reject', style: TextStyle(fontSize: 12)),
                                          ),
                                          const SizedBox(width: 8),
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppTheme.success,
                                              padding: const EdgeInsets.symmetric(horizontal: 14),
                                            ),
                                            onPressed: () => _showApprovalDialog(r, true),
                                            child: const Text('Approve', style: TextStyle(fontSize: 12)),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _timeBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
              Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }
}

