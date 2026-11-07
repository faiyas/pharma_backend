import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/employee_model.dart';
import '../../providers/manager_provider.dart';

class ManagerEmployeesScreen extends StatefulWidget {
  const ManagerEmployeesScreen({super.key});

  @override
  State<ManagerEmployeesScreen> createState() => _ManagerEmployeesScreenState();
}

class _ManagerEmployeesScreenState extends State<ManagerEmployeesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedStatus = 'ALL';
  int? _selectedShopId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mgr = context.read<ManagerProvider>();
      mgr.fetchBranches();
      mgr.fetchEmployees();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _filter() {
    context.read<ManagerProvider>().fetchEmployees(
      search: _searchController.text.trim(),
      status: _selectedStatus,
      shopId: _selectedShopId,
    );
  }

  void _showEmployeeDetails(EmployeeModel emp) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  emp.fullName,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${emp.designation} • ${emp.code}',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
            ),
            const Divider(height: 24),
            _infoRow('Branch', emp.shopName),
            _infoRow('Email', emp.email),
            _infoRow('Phone', emp.phone.isNotEmpty ? emp.phone : 'Not provided'),
            _infoRow('Date Joined', emp.dateJoined.isNotEmpty ? emp.dateJoined : '—'),
            _infoRow('Status', emp.isActive ? 'Active' : 'Inactive'),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(
                      emp.isActive ? Icons.person_off : Icons.person_add,
                      color: emp.isActive ? AppTheme.danger : AppTheme.success,
                    ),
                    label: Text(emp.isActive ? 'Deactivate' : 'Activate'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _confirmToggleStatus(emp);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.swap_horiz),
                    label: const Text('Transfer'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _showTransferDialog(emp);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }

  void _confirmToggleStatus(EmployeeModel emp) {
    final reasonController = TextEditingController();
    final isDeactivating = emp.isActive;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${isDeactivating ? "Deactivate" : "Activate"} ${emp.code}?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isDeactivating
                  ? 'Deactivating will disable this employee from checking in.'
                  : 'Reactivating will restore mobile attendance access for this employee.',
              style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(hintText: 'Enter reason / notes...'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isDeactivating ? AppTheme.danger : AppTheme.success,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await context.read<ManagerProvider>().toggleEmployeeStatus(
                    emp.id,
                    !isDeactivating,
                    reason: reasonController.text.trim(),
                  );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Employee status updated.' : 'Failed to update status.'),
                    backgroundColor: success ? AppTheme.success : AppTheme.danger,
                  ),
                );
              }
            },
            child: Text(isDeactivating ? 'Deactivate' : 'Activate'),
          ),
        ],
      ),
    );
  }

  void _showTransferDialog(EmployeeModel emp) {
    final mgr = context.read<ManagerProvider>();
    final reasonController = TextEditingController();
    final eligibleBranches = mgr.branches.where((b) => b.id != emp.shopId).toList();

    if (eligibleBranches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('At least two branches are required to perform a transfer.')),
      );
      return;
    }

    int targetShopId = eligibleBranches.first.id;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Transfer ${emp.fullName}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Current Branch: ${emp.shopName}', style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
              const SizedBox(height: 14),
              const Text('Target Destination Branch:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              DropdownButtonFormField<int>(
                initialValue: targetShopId,
                items: eligibleBranches
                    .map<DropdownMenuItem<int>>(
                      (b) => DropdownMenuItem<int>(
                        value: b.id,
                        child: Text(b.name),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() => targetShopId = val);
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(hintText: 'Transfer reason (required)...'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Reason is required.')),
                  );
                  return;
                }
                Navigator.pop(ctx);
                final success = await mgr.transferEmployee(
                  emp.id,
                  targetShopId,
                  reasonController.text.trim(),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? 'Employee transferred successfully!' : 'Transfer failed.'),
                      backgroundColor: success ? AppTheme.success : AppTheme.danger,
                    ),
                  );
                }
              },
              child: const Text('Transfer'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final employees = mgr.employees;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Staff Directory'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _filter(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter & Search Header
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by staff name or ID code...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              _filter();
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  onSubmitted: (_) => _filter(),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'ALL', label: Text('All')),
                          ButtonSegment(value: 'ACTIVE', label: Text('Active')),
                          ButtonSegment(value: 'INACTIVE', label: Text('Inactive')),
                        ],
                        selected: {_selectedStatus},
                        onSelectionChanged: (set) {
                          setState(() => _selectedStatus = set.first);
                          _filter();
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Employee List
          Expanded(
            child: mgr.isLoading && employees.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : employees.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people_outline, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            const Text('No employees found matching filter.', style: TextStyle(color: AppTheme.textMuted)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async => _filter(),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: employees.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (ctx, i) {
                            final emp = employees[i];
                            return Card(
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: emp.isActive ? AppTheme.primaryLight : AppTheme.border,
                                  child: Text(
                                    (emp.fullName.isNotEmpty ? emp.fullName[0] : 'E').toUpperCase(),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: emp.isActive ? AppTheme.primaryDark : AppTheme.textMuted,
                                    ),
                                  ),
                                ),
                                title: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        emp.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: emp.isActive
                                            ? AppTheme.success.withValues(alpha: 0.12)
                                            : AppTheme.danger.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        emp.isActive ? 'ACTIVE' : 'INACTIVE',
                                        style: TextStyle(
                                          color: emp.isActive ? AppTheme.success : AppTheme.danger,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 2),
                                    Text('${emp.code} • ${emp.designation}', style: const TextStyle(fontSize: 12)),
                                    Text(emp.shopName, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                  ],
                                ),
                                trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textMuted),
                                onTap: () => _showEmployeeDetails(emp),
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
}
