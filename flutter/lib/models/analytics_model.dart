class AnalyticsModel {
  final double attendancePercentage;
  final double punctualityRate;
  final int totalEmployees;
  final int totalPresentDays;
  final double totalHours;
  final double avgWorkingHours;
  final double overtimeHours;
  final int lateCount;
  final int earlyDepartureCount;
  final int missingCheckoutCount;
  final Map<String, dynamic> leaveStats;
  final Map<String, dynamic> correctionStats;

  AnalyticsModel({
    required this.attendancePercentage,
    required this.punctualityRate,
    required this.totalEmployees,
    required this.totalPresentDays,
    required this.totalHours,
    required this.avgWorkingHours,
    required this.overtimeHours,
    required this.lateCount,
    required this.earlyDepartureCount,
    required this.missingCheckoutCount,
    required this.leaveStats,
    required this.correctionStats,
  });

  factory AnalyticsModel.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic val) => val is num ? val.toDouble() : double.tryParse(val?.toString() ?? '0') ?? 0.0;
    int toInt(dynamic val) => val is int ? val : int.tryParse(val?.toString() ?? '0') ?? 0;

    return AnalyticsModel(
      attendancePercentage: toDouble(json['attendance_percentage']),
      punctualityRate: toDouble(json['punctuality_rate']),
      totalEmployees: toInt(json['total_employees']),
      totalPresentDays: toInt(json['total_present_days']),
      totalHours: toDouble(json['total_hours']),
      avgWorkingHours: toDouble(json['avg_working_hours']),
      overtimeHours: toDouble(json['overtime_hours']),
      lateCount: toInt(json['late_count']),
      earlyDepartureCount: toInt(json['early_departure_count']),
      missingCheckoutCount: toInt(json['missing_checkout_count']),
      leaveStats: (json['leave_stats'] is Map<String, dynamic>) ? json['leave_stats'] : {},
      correctionStats: (json['correction_stats'] is Map<String, dynamic>) ? json['correction_stats'] : {},
    );
  }
}

