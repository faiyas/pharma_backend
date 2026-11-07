import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConstants {
  static const String liveBackendUrl = 'https://pharma-backend-drjq.onrender.com/api';

  static String get baseUrl {
    final envUrl = dotenv.env['API_BASE_URL'];
    if (envUrl != null && envUrl.trim().isNotEmpty) {
      return envUrl.trim().replaceAll(RegExp(r'/+$'), '');
    }
    return liveBackendUrl;
  }

  // Auth endpoints
  static String get token => '$baseUrl/auth/token/';
  static String get tokenRefresh => '$baseUrl/auth/token/refresh/';
  static String get me => '$baseUrl/auth/me/';
  static String get changePassword => '$baseUrl/auth/change-password/';

  // Attendance endpoints
  static String get todayStatus => '$baseUrl/attendance/today/';
  static String get submitPunch => '$baseUrl/attendance/submit/';
  static String get attendanceRecords => '$baseUrl/attendance/';
  static String attendanceApprove(int id) => '$baseUrl/attendance/$id/approve/';
  static String attendanceReject(int id) => '$baseUrl/attendance/$id/reject/';

  // Leaves endpoints
  static String get leaves => '$baseUrl/leaves/';
  static String get leaveBalances => '$baseUrl/leaves/balances/';
  static String leaveApprove(int id) => '$baseUrl/leaves/$id/approve/';
  static String leaveReject(int id) => '$baseUrl/leaves/$id/reject/';

  // Corrections endpoints
  static String get corrections => '$baseUrl/attendance-corrections/';
  static String correctionApprove(int id) => '$baseUrl/attendance-corrections/$id/approve/';
  static String correctionReject(int id) => '$baseUrl/attendance-corrections/$id/reject/';

  // Monitoring & Shops endpoints
  static String get monitoringSummary => '$baseUrl/monitoring/summary/';
  static String get monitoringBranches => '$baseUrl/monitoring/branches/';
  static String get monitoringLiveActivity => '$baseUrl/monitoring/activity/';
  static String get shops => '$baseUrl/shops/';

  // Employee Lifecycle endpoints
  static String get employees => '$baseUrl/employees/';
  static String employeeActivate(int id) => '$baseUrl/employees/$id/activate/';
  static String employeeDeactivate(int id) => '$baseUrl/employees/$id/deactivate/';
  static String employeeTransfer(int id) => '$baseUrl/employees/$id/transfer/';
  static String employeeHistory(int id) => '$baseUrl/employees/$id/history/';

  // Analytics endpoints
  static String get analyticsOverview => '$baseUrl/analytics/overview/';
}

