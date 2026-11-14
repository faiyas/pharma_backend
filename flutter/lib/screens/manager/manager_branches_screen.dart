import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/shop_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/manager_provider.dart';
import '../../services/location_service.dart';

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

  // Dialog: Register New Pharmacy Branch
  void _showCreateBranchDialog() {
    final nameCtrl = TextEditingController();
    final addrCtrl = TextEditingController();
    final latCtrl = TextEditingController();
    final lngCtrl = TextEditingController();
    double radiusM = 100;
    bool isFetchingLocation = false;
    bool isSubmitting = false;

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
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Register Pharmacy Branch',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Pharmacy Branch Name *',
                    hintText: 'e.g. Apollo Pharmacy Central',
                    prefixIcon: Icon(Icons.storefront),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: addrCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Street Address *',
                    hintText: 'e.g. 45 North Main Road, Anna Nagar',
                    prefixIcon: Icon(Icons.location_on_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                // Auto-Fetch GPS Coordinates Button
                OutlinedButton.icon(
                  icon: isFetchingLocation
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.my_location, color: AppTheme.primary),
                  label: Text(
                    isFetchingLocation ? 'Fetching Device GPS...' : 'Auto-Fetch Current GPS Coordinates',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppTheme.primary),
                  ),
                  onPressed: isFetchingLocation
                      ? null
                      : () async {
                          setModalState(() => isFetchingLocation = true);
                          final loc = await LocationService.getCurrentLocation();
                          setModalState(() => isFetchingLocation = false);
                          if (loc.isSuccess && loc.position != null) {
                            latCtrl.text = loc.position!.latitude.toStringAsFixed(6);
                            lngCtrl.text = loc.position!.longitude.toStringAsFixed(6);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('GPS fetched! Accuracy: ±${loc.position!.accuracy.toStringAsFixed(1)}m'),
                                  backgroundColor: AppTheme.success,
                                ),
                              );
                            }
                          } else {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(loc.errorMessage ?? 'Could not fetch GPS.'),
                                  backgroundColor: AppTheme.danger,
                                ),
                              );
                            }
                          }
                        },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: latCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                        decoration: const InputDecoration(
                          labelText: 'Latitude *',
                          hintText: '13.0827',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: lngCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                        decoration: const InputDecoration(
                          labelText: 'Longitude *',
                          hintText: '80.2707',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Allowed Geofence Radius:', style: TextStyle(fontWeight: FontWeight.bold)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${radiusM.toStringAsFixed(0)} meters',
                        style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                Slider(
                  value: radiusM,
                  min: 30,
                  max: 500,
                  divisions: 47,
                  label: '${radiusM.toInt()}m',
                  activeColor: AppTheme.primary,
                  onChanged: (v) => setModalState(() => radiusM = v),
                ),
                const SizedBox(height: 18),
                ElevatedButton.icon(
                  icon: isSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.add_business),
                  label: Text(isSubmitting ? 'Registering...' : 'Register Pharmacy Branch'),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final name = nameCtrl.text.trim();
                          final addr = addrCtrl.text.trim();
                          final lat = double.tryParse(latCtrl.text.trim());
                          final lng = double.tryParse(lngCtrl.text.trim());

                          if (name.isEmpty || addr.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter Branch Name and Address.')),
                            );
                            return;
                          }
                          if (lat == null || lng == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter or auto-fetch Latitude and Longitude.')),
                            );
                            return;
                          }

                          setModalState(() => isSubmitting = true);
                          final mgr = context.read<ManagerProvider>();
                          final success = await mgr.createBranch(
                            name: name,
                            address: addr,
                            latitude: lat,
                            longitude: lng,
                            allowedRadiusM: radiusM.toInt(),
                          );
                          setModalState(() => isSubmitting = false);

                          if (mounted) {
                            if (success) {
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Pharmacy branch registered successfully!'),
                                  backgroundColor: AppTheme.success,
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(mgr.errorMessage ?? 'Registration failed.'),
                                  backgroundColor: AppTheme.danger,
                                ),
                              );
                            }
                          }
                        },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Dialog: Batch Generate Staff for a Branch
  void _showGenerateEmployeesDialog(ShopModel shop) {
    int count = 5;
    bool isGenerating = false;

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
                  Text('Onboard Staff for ${shop.name}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Generate staff accounts for branch ${shop.code}. Each account will have a temporary password (1234) and will be prompted to set up their profile on first login.',
                style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Number of Accounts:', style: TextStyle(fontWeight: FontWeight.bold)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(color: AppTheme.primaryLight, borderRadius: BorderRadius.circular(8)),
                    child: Text('$count Staff Accounts', style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              Slider(
                value: count.toDouble(),
                min: 1,
                max: 30,
                divisions: 29,
                label: '$count',
                activeColor: AppTheme.primary,
                onChanged: (v) => setModalState(() => count = v.toInt()),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                icon: isGenerating
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.people_outline),
                label: Text(isGenerating ? 'Generating Accounts...' : 'Generate $count Accounts'),
                onPressed: isGenerating
                    ? null
                    : () async {
                        setModalState(() => isGenerating = true);
                        final mgr = context.read<ManagerProvider>();
                        final result = await mgr.generateEmployees(shop.id, count);
                        setModalState(() => isGenerating = false);

                        if (mounted) {
                          Navigator.pop(ctx);
                          if (result.isNotEmpty) {
                            _showGeneratedCredentialsDialog(shop, result);
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(mgr.errorMessage ?? 'Could not generate staff accounts.'),
                                backgroundColor: AppTheme.danger,
                              ),
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

  // Dialog: Show Generated Credentials with WhatsApp / Copy All Button
  void _showGeneratedCredentialsDialog(ShopModel shop, List<Map<String, String>> credentials) {
    final buffer = StringBuffer();
    buffer.writeln('🏥 *${shop.name}* (${shop.code}) - Staff Login Credentials:');
    buffer.writeln('----------------------------------------');
    for (var c in credentials) {
      buffer.writeln('👤 Username: ${c['username']} | Password: ${c['temporary_password']}');
    }
    buffer.writeln('----------------------------------------');
    buffer.writeln('📲 Please log in via the PharmaTrack mobile app and update your password.');

    final shareText = buffer.toString();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: AppTheme.success),
            const SizedBox(width: 8),
            Text('Created ${credentials.length} Accounts'),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Temporary credentials generated for ${shop.name}:', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 10),
              Container(
                constraints: const BoxConstraints(maxHeight: 200),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppTheme.bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.border)),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: credentials.length,
                  separatorBuilder: (_, __) => const Divider(height: 12),
                  itemBuilder: (_, i) => Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(credentials[i]['username'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                      Text('Pass: ${credentials[i]['temporary_password']}', style: const TextStyle(color: AppTheme.textMuted, fontFamily: 'monospace')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text('Share these credentials with your staff to let them log in and complete account onboarding.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          ElevatedButton.icon(
            icon: const Icon(Icons.copy, size: 16),
            label: const Text('Copy to WhatsApp / SMS'),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: shareText));
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Credentials copied to clipboard! Ready to share on WhatsApp.'), backgroundColor: AppTheme.success),
              );
            },
          ),
        ],
      ),
    );
  }

  // Dialog: Edit Geofence Radius
  void _showEditGeofenceDialog(ShopModel shop) {
    double radiusM = shop.allowedRadiusM;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Edit Geofence - ${shop.name}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Allowed Radius:'),
                  Text('${radiusM.toInt()} meters', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                ],
              ),
              Slider(
                value: radiusM,
                min: 20,
                max: 500,
                divisions: 48,
                label: '${radiusM.toInt()}m',
                onChanged: (v) => setDialogState(() => radiusM = v),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: isSaving
                  ? null
                  : () async {
                      setDialogState(() => isSaving = true);
                      final ok = await context.read<ManagerProvider>().updateBranch(shop.id, allowedRadiusM: radiusM.toInt());
                      if (mounted) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(ok ? 'Geofence updated to ${radiusM.toInt()}m!' : 'Failed to update geofence.'),
                            backgroundColor: ok ? AppTheme.success : AppTheme.danger,
                          ),
                        );
                      }
                    },
              child: const Text('Save Radius'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mgr = context.watch<ManagerProvider>();
    final user = context.watch<AuthProvider>().currentUser;
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
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add_business),
        label: const Text('Register Branch'),
        onPressed: _showCreateBranchDialog,
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
                      const Text('No pharmacy branches registered yet.', style: TextStyle(color: AppTheme.textMuted, fontSize: 16)),
                      const SizedBox(height: 8),
                      const Text('Tap "+ Register Branch" to configure your first pharmacy store.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => mgr.fetchBranches(),
                  child: ListView.separated(
                    padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 80),
                    itemCount: branches.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
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
                                          '${shop.allowedRadiusM.toStringAsFixed(0)}m',
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
                                      'GPS: ${shop.latitude.toStringAsFixed(4)}, ${shop.longitude.toStringAsFixed(4)}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontFamily: 'monospace'),
                                    ),
                                    InkWell(
                                      onTap: () => _showEditGeofenceDialog(shop),
                                      child: const Row(
                                        children: [
                                          Icon(Icons.edit, size: 13, color: AppTheme.primary),
                                          SizedBox(width: 4),
                                          Text('Edit Radius', style: TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      icon: const Icon(Icons.group_add, size: 16),
                                      label: const Text('Generate Staff'),
                                      onPressed: () => _showGenerateEmployeesDialog(shop),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      icon: const Icon(Icons.radar, size: 16),
                                      label: const Text('Geofence'),
                                      onPressed: () => _showEditGeofenceDialog(shop),
                                    ),
                                  ),
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
