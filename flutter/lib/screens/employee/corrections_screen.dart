import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/attendance_provider.dart';

class CorrectionsScreen extends StatefulWidget {
  const CorrectionsScreen({super.key});

  @override
  State<CorrectionsScreen> createState() => _CorrectionsScreenState();
}

class _CorrectionsScreenState extends State<CorrectionsScreen> {
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = const TimeOfDay(hour: 9, minute: 0);
  String _eventType = 'CHECK_IN';
  final TextEditingController _reasonController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AttendanceProvider>().fetchMyCorrections();
    });
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 60)),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );
    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }

  Future<void> _submitRequest() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a reason for the correction request.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final dt = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _selectedTime.hour,
      _selectedTime.minute,
    );
    final requestedIso = DateFormat("yyyy-MM-dd'T'HH:mm:ss").format(dt);

    final attProv = context.read<AttendanceProvider>();
    final success = await attProv.requestCorrection(
      attendanceDate: dateStr,
      eventType: _eventType,
      requestedTimestamp: requestedIso,
      reason: reason,
    );

    setState(() => _isSubmitting = false);

    if (mounted) {
      if (success) {
        _reasonController.clear();
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Correction request submitted for manager review.'),
            backgroundColor: AppTheme.success,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(attProv.errorMessage ?? 'Submission failed.'),
            backgroundColor: AppTheme.danger,
          ),
        );
      }
    }
  }

  void _showNewRequestDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Request Attendance Correction',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Event Type Toggle
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Check In Fix')),
                      selected: _eventType == 'CHECK_IN',
                      selectedColor: AppTheme.primaryLight,
                      labelStyle: TextStyle(
                        color: _eventType == 'CHECK_IN' ? AppTheme.primaryDark : AppTheme.textMuted,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (val) => setModalState(() => _eventType = 'CHECK_IN'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Check Out Fix')),
                      selected: _eventType == 'CHECK_OUT',
                      selectedColor: AppTheme.primaryLight,
                      labelStyle: TextStyle(
                        color: _eventType == 'CHECK_OUT' ? AppTheme.primaryDark : AppTheme.textMuted,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (val) => setModalState(() => _eventType = 'CHECK_OUT'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // Date and Time Pickers
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(DateFormat('yyyy-MM-dd').format(_selectedDate)),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _selectedDate,
                          firstDate: DateTime.now().subtract(const Duration(days: 60)),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) {
                          setModalState(() => _selectedDate = picked);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.access_time, size: 16),
                      label: Text(_selectedTime.format(context)),
                      onPressed: () async {
                        final picked = await showTimePicker(
                          context: context,
                          initialTime: _selectedTime,
                        );
                        if (picked != null) {
                          setModalState(() => _selectedTime = picked);
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Reason for Regularization *',
                  hintText: 'e.g. GPS error, missed check-in on emergency duty',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                icon: _isSubmitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.send),
                label: Text(_isSubmitting ? 'Submitting...' : 'Submit Regularization Request'),
                onPressed: _isSubmitting ? null : _submitRequest,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attProv = context.watch<AttendanceProvider>();
    final corrections = attProv.myCorrections;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance Regularization'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => attProv.fetchMyCorrections(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('New Correction'),
        onPressed: _showNewRequestDialog,
      ),
      body: corrections.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.edit_calendar, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  const Text(
                    'No correction requests submitted.',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tap "+ New Correction" if you missed a punch.',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => attProv.fetchMyCorrections(),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: corrections.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (ctx, i) {
                  final c = corrections[i];
                  Color statusColor = AppTheme.warning;
                  if (c.status.toUpperCase() == 'APPROVED') statusColor = AppTheme.success;
                  if (c.status.toUpperCase() == 'REJECTED') statusColor = AppTheme.danger;

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  c.eventType == 'CHECK_IN' ? 'Check In Regularization' : 'Check Out Regularization',
                                  style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  c.status.toUpperCase(),
                                  style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 14, color: AppTheme.textMuted),
                              const SizedBox(width: 6),
                              Text('Date: ${c.attendanceDate}', style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(width: 16),
                              const Icon(Icons.access_time, size: 14, color: AppTheme.textMuted),
                              const SizedBox(width: 6),
                              Text('Requested: ${c.requestedTimestamp}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text('Reason: ${c.reason}', style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                          if (c.reviewComments != null && c.reviewComments!.isNotEmpty) ...[
                            const Divider(height: 16),
                            Text(
                              'Manager Remark: ${c.reviewComments}',
                              style: TextStyle(
                                color: c.status.toUpperCase() == 'APPROVED' ? AppTheme.success : AppTheme.danger,
                                fontStyle: FontStyle.italic,
                                fontSize: 12,
                              ),
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

