import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';

class PunchScreen extends StatefulWidget {
  const PunchScreen({super.key});

  @override
  State<PunchScreen> createState() => _PunchScreenState();
}

class _PunchScreenState extends State<PunchScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AttendanceProvider>().fetchTodayStatus();
    });
  }

  Future<void> _handlePunch(String eventType) async {
    final att = context.read<AttendanceProvider>();

    if (!att.hasSelfie) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please capture a front camera selfie before punching!'),
          backgroundColor: AppTheme.warning,
        ),
      );
      return;
    }

    final success = await att.submitPunch(eventType: eventType);

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(eventType == 'CHECK_IN'
                ? 'Check-In recorded successfully!'
                : 'Check-Out recorded successfully!'),
            backgroundColor: AppTheme.success,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(att.errorMessage ?? 'Punch rejected.'),
            backgroundColor: AppTheme.danger,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final user = context.watch<AuthProvider>().currentUser;
    final shop = att.todayStatus?.shop ?? user?.assignedShop;
    final timeFmt = DateFormat('hh:mm:ss a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Punch Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Status',
            onPressed: att.isLoading ? null : () => att.fetchTodayStatus(),
          ),
        ],
      ),
      body: att.isLoading && att.todayStatus == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => att.fetchTodayStatus(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Branch & Geofence Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.storefront, color: AppTheme.primary, size: 24),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    shop?.name ?? 'Assigned Pharmacy',
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                if (shop != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Radius: ${shop.allowedRadiusM.toStringAsFixed(0)}m',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.primaryDark,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            if (shop != null && shop.address.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                shop.address,
                                style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                              ),
                            ],
                            const Divider(height: 24),

                            // Geofence Distance Indicator
                            Row(
                              children: [
                                Icon(
                                  att.isWithinGeofence ? Icons.check_circle : Icons.warning_amber_rounded,
                                  color: att.isWithinGeofence ? AppTheme.success : AppTheme.danger,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        att.isWithinGeofence
                                            ? 'Inside Branch Geofence'
                                            : 'Outside Branch Geofence',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: att.isWithinGeofence ? AppTheme.success : AppTheme.danger,
                                        ),
                                      ),
                                      if (att.distanceToShopM != null)
                                        Text(
                                          'Distance: ${att.distanceToShopM!.toStringAsFixed(1)}m from center',
                                          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                        ),
                                      if (att.locationError != null)
                                        Text(
                                          att.locationError!,
                                          style: const TextStyle(fontSize: 11, color: AppTheme.danger),
                                        ),
                                    ],
                                  ),
                                ),
                                TextButton.icon(
                                  onPressed: att.isFetchingLocation
                                      ? null
                                      : () {
                                          if (shop != null) att.checkLocationAndGeofence(shop);
                                        },
                                  icon: att.isFetchingLocation
                                      ? const SizedBox(
                                          width: 14,
                                          height: 14,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.my_location, size: 16),
                                  label: const Text('Refresh GPS', style: TextStyle(fontSize: 12)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Front Camera Selfie Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.photo_camera_front, color: AppTheme.primary, size: 22),
                                SizedBox(width: 8),
                                Text(
                                  'Photo Verification (Front Camera)',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),

                            if (att.hasSelfie && att.selfieFile != null) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.file(
                                  att.selfieFile!,
                                  width: 140,
                                  height: 140,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: () => att.captureSelfie(),
                                icon: const Icon(Icons.camera_alt_outlined, size: 18),
                                label: const Text('Retake Selfie'),
                              ),
                            ] else ...[
                              InkWell(
                                onTap: () => att.captureSelfie(),
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  height: 130,
                                  decoration: BoxDecoration(
                                    color: AppTheme.bg,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: AppTheme.border, style: BorderStyle.solid),
                                  ),
                                  child: const Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.add_a_photo_outlined, size: 36, color: AppTheme.primary),
                                        SizedBox(height: 8),
                                        Text(
                                          'Tap to Capture Front Camera Selfie',
                                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textMain),
                                        ),
                                        SizedBox(height: 4),
                                        Text(
                                          'Mandatory photo proof for attendance punch',
                                          style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Today's Status Banner
                    if (att.todayStatus != null) ...[
                      Card(
                        color: Colors.white,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              Column(
                                children: [
                                  const Text('Check-In', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  const SizedBox(height: 4),
                                  Text(
                                    att.todayStatus!.checkedIn && att.todayStatus!.checkInTime != null
                                        ? timeFmt.format(att.todayStatus!.checkInTime!)
                                        : '—',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: att.todayStatus!.checkedIn ? AppTheme.success : AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                              Container(height: 28, width: 1, color: AppTheme.border),
                              Column(
                                children: [
                                  const Text('Check-Out', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  const SizedBox(height: 4),
                                  Text(
                                    att.todayStatus!.checkedOut && att.todayStatus!.checkOutTime != null
                                        ? timeFmt.format(att.todayStatus!.checkOutTime!)
                                        : '—',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: att.todayStatus!.checkedOut ? AppTheme.accent : AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Punch In & Out Actions
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                            onPressed: (att.isPunching || (att.todayStatus?.checkedIn ?? false))
                                ? null
                                : () => _handlePunch('CHECK_IN'),
                            icon: const Icon(Icons.login),
                            label: Text(
                              (att.todayStatus?.checkedIn ?? false) ? 'Checked In' : 'Punch In',
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accent,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                            onPressed: (att.isPunching ||
                                    !(att.todayStatus?.checkedIn ?? false) ||
                                    (att.todayStatus?.checkedOut ?? false))
                                ? null
                                : () => _handlePunch('CHECK_OUT'),
                            icon: const Icon(Icons.logout),
                            label: Text(
                              (att.todayStatus?.checkedOut ?? false) ? 'Checked Out' : 'Punch Out',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

