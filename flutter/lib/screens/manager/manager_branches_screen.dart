import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/manager_provider.dart';

class ManagerBranchesScreen extends StatefulWidget {
  const ManagerBranchesScreen({super.key});

  @override
  State<ManagerBranchesScreen> createState() => _ManagerBranchesScreenState();
}

class _ManagerBranchesScreenState extends State<ManagerBranchesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ManagerProvider>().fetchBranches();
    });
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final branches = mgr.branches;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Branches & Geofences'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Branches',
            onPressed: () => mgr.fetchBranches(),
          ),
        ],
      ),
      body: mgr.isLoading && branches.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : branches.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.storefront, size: 56, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                      const SizedBox(height: 12),
                      const Text('No branches assigned to your account.', style: TextStyle(color: AppTheme.textMuted)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => mgr.fetchBranches(),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: branches.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (ctx, i) {
                      final shop = branches[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryLight,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.storefront, color: AppTheme.primary, size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          shop.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                        ),
                                        Text(
                                          'Code: ${shop.code}',
                                          style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppTheme.success.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.radar, size: 14, color: AppTheme.success),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${shop.allowedRadiusM.toStringAsFixed(0)}m Geofence',
                                          style: const TextStyle(
                                            color: AppTheme.success,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              if (shop.address.isNotEmpty) ...[
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.textMuted),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        shop.address,
                                        style: const TextStyle(fontSize: 13, color: AppTheme.textMain),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                              ],
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppTheme.bg,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppTheme.border),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'GPS: ${shop.latitude.toStringAsFixed(5)}, ${shop.longitude.toStringAsFixed(5)}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontFamily: 'monospace'),
                                    ),
                                    const Text(
                                      'Radius verified',
                                      style: TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
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

