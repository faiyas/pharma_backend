import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/manager_provider.dart';

class ManagerAuditScreen extends StatefulWidget {
  const ManagerAuditScreen({super.key});

  @override
  State<ManagerAuditScreen> createState() => _ManagerAuditScreenState();
}

class _ManagerAuditScreenState extends State<ManagerAuditScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ManagerProvider>().fetchAuditLogs();
    });
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final logs = mgr.auditLogs;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Security & Audit Logs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => mgr.fetchAuditLogs(),
          ),
        ],
      ),
      body: mgr.isLoading && logs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : logs.isEmpty
              ? const Center(
                  child: Text('No audit logs recorded yet.', style: TextStyle(color: AppTheme.textMuted)),
                )
              : RefreshIndicator(
                  onRefresh: () => mgr.fetchAuditLogs(),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: logs.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final log = logs[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      log.action,
                                      style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold, fontSize: 11),
                                    ),
                                  ),
                                  Text(
                                    log.createdAt.length >= 16 ? log.createdAt.substring(0, 16) : log.createdAt,
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(log.details, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.person, size: 14, color: AppTheme.textMuted),
                                  const SizedBox(width: 4),
                                  Text('Actor: ${log.user}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                  if (log.role != null) ...[
                                    const SizedBox(width: 8),
                                    Text('(${log.role})', style: const TextStyle(fontSize: 11, color: AppTheme.primary)),
                                  ],
                                ],
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

