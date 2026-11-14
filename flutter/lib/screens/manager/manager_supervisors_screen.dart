import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/manager_model.dart';
import '../../models/shop_model.dart';
import '../../providers/manager_provider.dart';

class ManagerSupervisorsScreen extends StatefulWidget {
  const ManagerSupervisorsScreen({super.key});

  @override
  State<ManagerSupervisorsScreen> createState() => _ManagerSupervisorsScreenState();
}

class _ManagerSupervisorsScreenState extends State<ManagerSupervisorsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mgr = context.read<ManagerProvider>();
      mgr.fetchManagers();
      mgr.fetchBranches();
    });
  }

  void _showCreateManagerDialog() {
    final userCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Create Branch Supervisor', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 8),
              const Text('Authorize supervisors to manage pharmacy stores, review attendances, and approve leaves.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
              const SizedBox(height: 16),
              TextField(
                controller: userCtrl,
                decoration: const InputDecoration(
                  labelText: 'Manager Username *',
                  hintText: 'e.g. manager_anna_nagar',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: passCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Initial Password (8+ characters) *',
                  prefixIcon: Icon(Icons.lock_outline),
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                icon: isSubmitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.person_add),
                label: Text(isSubmitting ? 'Creating Account...' : 'Create Manager Account'),
                onPressed: isSubmitting
                    ? null
                    : () async {
                        final username = userCtrl.text.trim();
                        final password = passCtrl.text.trim();

                        if (username.isEmpty || password.length < 8) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Username and password (8+ characters) required.')),
                          );
                          return;
                        }

                        setModalState(() => isSubmitting = true);
                        final mgr = context.read<ManagerProvider>();
                        final success = await mgr.createManager(username, password);
                        setModalState(() => isSubmitting = false);

                        if (mounted) {
                          if (success) {
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Manager "$username" created successfully!'), backgroundColor: AppTheme.success),
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(mgr.errorMessage ?? 'Failed to create manager.'), backgroundColor: AppTheme.danger),
                            );
                          }
                        }
                      },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAssignBranchDialog(ManagerAccountModel manager) {
    final branches = context.read<ManagerProvider>().branches;
    int? selectedShopId = branches.isNotEmpty ? branches.first.id : null;
    bool isAssigning = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Assign Branch to ${manager.username}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select a pharmacy branch to link this manager:', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
              const SizedBox(height: 14),
              if (branches.isEmpty)
                const Text('No branches available. Register branches first.')
              else
                DropdownButtonFormField<int>(
                  value: selectedShopId,
                  decoration: const InputDecoration(labelText: 'Pharmacy Branch'),
                  items: branches
                      .map((b) => DropdownMenuItem(value: b.id, child: Text('${b.name} (${b.code})')))
                      .toList(),
                  onChanged: (val) => setDialogState(() => selectedShopId = val),
                ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: (selectedShopId == null || isAssigning)
                  ? null
                  : () async {
                      setDialogState(() => isAssigning = true);
                      final mgr = context.read<ManagerProvider>();
                      final ok = await mgr.assignManagerToShop(selectedShopId!, manager.id, remove: false);
                      if (mounted) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(ok ? 'Assigned branch successfully!' : (mgr.errorMessage ?? 'Assignment failed.')),
                            backgroundColor: ok ? AppTheme.success : AppTheme.danger,
                          ),
                        );
                      }
                    },
              child: const Text('Assign Branch'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmRemoveBranch(ManagerAccountModel manager, ManagedShopInfo shop) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unassign Manager'),
        content: Text('Remove supervisor "${manager.username}" from "${shop.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () async {
              Navigator.pop(ctx);
              final mgr = context.read<ManagerProvider>();
              final ok = await mgr.assignManagerToShop(shop.id, manager.id, remove: true);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok ? 'Removed manager from ${shop.name}.' : 'Action failed.'),
                    backgroundColor: ok ? AppTheme.success : AppTheme.danger,
                  ),
                );
              }
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final managers = mgr.managers;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Supervisors & Managers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              mgr.fetchManagers();
              mgr.fetchBranches();
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.person_add),
        label: const Text('Add Manager'),
        onPressed: _showCreateManagerDialog,
      ),
      body: managers.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shield_outlined, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  const Text('No manager accounts created yet.', style: TextStyle(color: AppTheme.textMuted, fontSize: 16)),
                  const SizedBox(height: 8),
                  const Text('Tap "+ Add Manager" to create branch supervisors.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () async {
                await mgr.fetchManagers();
                await mgr.fetchBranches();
              },
              child: ListView.separated(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 80),
                itemCount: managers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (ctx, i) {
                  final m = managers[i];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: AppTheme.primaryLight,
                                child: Text(
                                  m.username.isNotEmpty ? m.username[0].toUpperCase() : 'M',
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(m.username, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                    Text('Joined: ${m.dateJoined}', style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                                  ],
                                ),
                              ),
                              OutlinedButton.icon(
                                icon: const Icon(Icons.add_link, size: 14),
                                label: const Text('Assign'),
                                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                                onPressed: () => _showAssignBranchDialog(m),
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          const Text('Assigned Branches:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                          const SizedBox(height: 8),
                          if (m.managedShops.isEmpty)
                            const Text('No branches assigned yet.', style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: AppTheme.textMuted))
                          else
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: m.managedShops
                                  .map(
                                    (shop) => Chip(
                                      avatar: const Icon(Icons.storefront, size: 16, color: AppTheme.primary),
                                      label: Text('${shop.name} (${shop.code})', style: const TextStyle(fontSize: 12)),
                                      deleteIcon: const Icon(Icons.cancel, size: 16),
                                      onDeleted: () => _confirmRemoveBranch(m, shop),
                                    ),
                                  )
                                  .toList(),
                            ),
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

