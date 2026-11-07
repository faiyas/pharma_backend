import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/manager_provider.dart';

class ManagerMonitoringScreen extends StatefulWidget {
  const ManagerMonitoringScreen({super.key});

  @override
  State<ManagerMonitoringScreen> createState() => _ManagerMonitoringScreenState();
}

class _ManagerMonitoringScreenState extends State<ManagerMonitoringScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ManagerProvider>().fetchLiveActivity();
    });
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Monitoring Stream'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => mgr.fetchLiveActivity(),
          ),
        ],
      ),
      body: mgr.liveActivity.isEmpty
          ? const Center(
              child: Text(
                'No live attendance events today yet.',
                style: TextStyle(color: AppTheme.textMuted),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => mgr.fetchLiveActivity(),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: mgr.liveActivity.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, i) {
                  final act = mgr.liveActivity[i];
                  final kind = act['kind']?.toString() ?? 'PUNCH';
                  final isCheckIn = kind == 'CHECK_IN';

                  return Card(
                    child: ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isCheckIn ? AppTheme.primaryLight : const Color(0xFFE0F2FE),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isCheckIn ? Icons.login : Icons.logout,
                          color: isCheckIn ? AppTheme.primary : AppTheme.accent,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        act['employee_name'] ?? 'Staff',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      subtitle: Text(
                        '${act['shop_name'] ?? ''} • ${act['timestamp'] ?? ''}',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                      ),
                      trailing: Text(
                        isCheckIn ? 'Checked In' : 'Checked Out',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isCheckIn ? AppTheme.success : AppTheme.accent,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

