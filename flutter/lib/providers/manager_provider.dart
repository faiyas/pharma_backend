import 'package:flutter/material.dart';
import '../config/api_constants.dart';
import '../models/analytics_model.dart';
import '../models/attendance_model.dart';
import '../models/correction_model.dart';
import '../models/employee_model.dart';
import '../models/shop_model.dart';
import '../services/api_service.dart';

class ManagerSummaryModel {
  final int totalEmployees;
  final int presentCount;
  final int currentlyWorking;
  final int notCheckedIn;
  final int onLeaveCount;
  final int lateArrivals;
  final int missingCheckouts;
  final int pendingLeaves;
  final int pendingCorrections;
  final int pendingCheckIns;

  ManagerSummaryModel({
    required this.totalEmployees,
    required this.presentCount,
    required this.currentlyWorking,
    required this.notCheckedIn,
    required this.onLeaveCount,
    required this.lateArrivals,
    required this.missingCheckouts,
    required this.pendingLeaves,
    required this.pendingCorrections,
    required this.pendingCheckIns,
  });

  factory ManagerSummaryModel.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => v is int ? v : int.tryParse(v?.toString() ?? '0') ?? 0;
    final total = toInt(json['total_employees']);
    final present = toInt(json['checked_in_today'] ?? json['present_count'] ?? json['present']);
    final working = toInt(json['currently_working']);
    final notIn = toInt(json['not_checked_in']);
    final onLeave = toInt(json['on_leave_today'] ?? json['on_leave_count'] ?? json['on_leave']);
    final lateArr = toInt(json['late_arrivals']);
    final missingOut = toInt(json['missing_checkouts']);
    final leaves = toInt(json['pending_leaves']);
    final corrections = toInt(json['pending_corrections']);
    final pendingTotal = leaves + corrections;

    return ManagerSummaryModel(
      totalEmployees: total,
      presentCount: present,
      currentlyWorking: working > 0 ? working : present,
      notCheckedIn: notIn,
      onLeaveCount: onLeave,
      lateArrivals: lateArr,
      missingCheckouts: missingOut,
      pendingLeaves: leaves,
      pendingCorrections: corrections,
      pendingCheckIns: pendingTotal > 0 ? pendingTotal : notIn,
    );
  }
}

class ManagerProvider extends ChangeNotifier {
  ManagerSummaryModel? _summary;
  List<ShopModel> _branches = [];
  List<EmployeeModel> _employees = [];
  List<AttendanceRecordModel> _attendanceRecords = [];
  List<AttendanceRecordModel> _pendingAttendanceReviews = [];
  List<CorrectionModel> _corrections = [];
  List<CorrectionModel> _pendingCorrections = [];
  List<dynamic> _liveActivity = [];
  AnalyticsModel? _analytics;

  bool _isLoading = false;
  String? _errorMessage;

  ManagerSummaryModel? get summary => _summary;
  List<ShopModel> get branches => _branches;
  List<EmployeeModel> get employees => _employees;
  List<AttendanceRecordModel> get attendanceRecords => _attendanceRecords;
  List<AttendanceRecordModel> get pendingAttendanceReviews => _pendingAttendanceReviews;
  List<CorrectionModel> get corrections => _corrections;
  List<CorrectionModel> get pendingCorrections => _pendingCorrections;
  List<dynamic> get liveActivity => _liveActivity;
  AnalyticsModel? get analytics => _analytics;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  int get totalPendingApprovals =>
      _pendingAttendanceReviews.length +
      _pendingCorrections.length +
      (_summary?.pendingLeaves ?? 0);

  Future<void> fetchDashboardData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.wait([
        fetchSummary(),
        fetchBranches(),
        fetchLiveActivity(),
        fetchPendingAttendanceReviews(),
        fetchCorrections(),
      ]);
    } catch (e) {
      _errorMessage = 'Failed to load manager dashboard: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchSummary() async {
    final res = await ApiService.get(ApiConstants.monitoringSummary);
    if (res.success && res.data is Map<String, dynamic>) {
      _summary = ManagerSummaryModel.fromJson(res.data);
      notifyListeners();
    }
  }

  Future<void> fetchBranches() async {
    final res = await ApiService.get(ApiConstants.shops);
    if (res.success && res.data is List) {
      _branches = (res.data as List)
          .map((item) => ShopModel.fromJson(item as Map<String, dynamic>))
          .toList();
      notifyListeners();
    }
  }

  Future<void> fetchEmployees({String? search, String? status, int? shopId}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final queryParams = <String>[];
      if (search != null && search.trim().isNotEmpty) {
        queryParams.add('search=${Uri.encodeComponent(search.trim())}');
      }
      if (status != null && status != 'ALL') {
        queryParams.add('status=$status');
      }
      if (shopId != null) {
        queryParams.add('shop_id=$shopId');
      }
      final qs = queryParams.isNotEmpty ? '?${queryParams.join('&')}' : '';

      final res = await ApiService.get('${ApiConstants.employees}$qs');
      if (res.success && res.data is List) {
        _employees = (res.data as List)
            .map((item) => EmployeeModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAttendanceRecords({String? date, int? shopId, String? status}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final queryParams = <String>[];
      if (date != null && date.isNotEmpty) queryParams.add('date=$date');
      if (shopId != null) queryParams.add('shop_id=$shopId');
      if (status != null && status != 'ALL') queryParams.add('status=$status');
      final qs = queryParams.isNotEmpty ? '?${queryParams.join('&')}' : '';

      final res = await ApiService.get('${ApiConstants.attendanceRecords}$qs');
      if (res.success && res.data is List) {
        _attendanceRecords = (res.data as List)
            .map((item) => AttendanceRecordModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchLiveActivity() async {
    final res = await ApiService.get(ApiConstants.monitoringLiveActivity);
    if (res.success && res.data is List) {
      _liveActivity = res.data;
      notifyListeners();
    }
  }

  Future<void> fetchPendingAttendanceReviews() async {
    final res = await ApiService.get(ApiConstants.attendanceRecords);
    if (res.success && res.data is List) {
      final all = (res.data as List)
          .map((item) => AttendanceRecordModel.fromJson(item as Map<String, dynamic>))
          .toList();
      _attendanceRecords = all;
      _pendingAttendanceReviews = all
          .where((a) => a.reviewStatus == 'PENDING_REVIEW' || a.status == 'PENDING')
          .toList();
      notifyListeners();
    }
  }

  Future<void> fetchCorrections() async {
    final res = await ApiService.get(ApiConstants.corrections);
    if (res.success && res.data is List) {
      _corrections = (res.data as List)
          .map((c) => CorrectionModel.fromJson(c as Map<String, dynamic>))
          .toList();
      _pendingCorrections = _corrections.where((c) => c.isPending).toList();
      notifyListeners();
    }
  }

  Future<void> fetchAnalytics({int? shopId, String? startDate, String? endDate}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final queryParams = <String>[];
      if (shopId != null) queryParams.add('shop_id=$shopId');
      if (startDate != null) queryParams.add('start_date=$startDate');
      if (endDate != null) queryParams.add('end_date=$endDate');
      final qs = queryParams.isNotEmpty ? '?${queryParams.join('&')}' : '';

      final res = await ApiService.get('${ApiConstants.analyticsOverview}$qs');
      if (res.success && res.data is Map<String, dynamic>) {
        _analytics = AnalyticsModel.fromJson(res.data);
      }
    } catch (_) {
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> toggleEmployeeStatus(int id, bool activate, {String reason = ''}) async {
    final url = activate
        ? ApiConstants.employeeActivate(id)
        : ApiConstants.employeeDeactivate(id);
    final res = await ApiService.post(url, body: {'reason': reason});
    if (res.success) {
      await fetchEmployees();
      await fetchSummary();
      return true;
    }
    return false;
  }

  Future<bool> transferEmployee(int id, int toShopId, String reason) async {
    final res = await ApiService.post(
      ApiConstants.employeeTransfer(id),
      body: {'to_shop_id': toShopId, 'reason': reason},
    );
    if (res.success) {
      await fetchEmployees();
      await fetchBranches();
      return true;
    }
    return false;
  }

  Future<bool> approveAttendance(int id, {String comments = ''}) async {
    final res = await ApiService.post(
      ApiConstants.attendanceApprove(id),
      body: {'comments': comments},
    );
    if (res.success) {
      await fetchPendingAttendanceReviews();
      await fetchSummary();
      return true;
    }
    return false;
  }

  Future<bool> rejectAttendance(int id, {String comments = ''}) async {
    final res = await ApiService.post(
      ApiConstants.attendanceReject(id),
      body: {'comments': comments},
    );
    if (res.success) {
      await fetchPendingAttendanceReviews();
      await fetchSummary();
      return true;
    }
    return false;
  }

  Future<bool> approveCorrection(int id, {String comments = ''}) async {
    final res = await ApiService.post(
      ApiConstants.correctionApprove(id),
      body: {'comments': comments},
    );
    if (res.success) {
      await fetchCorrections();
      await fetchSummary();
      return true;
    }
    return false;
  }

  Future<bool> rejectCorrection(int id, {String comments = ''}) async {
    final res = await ApiService.post(
      ApiConstants.correctionReject(id),
      body: {'comments': comments},
    );
    if (res.success) {
      await fetchCorrections();
      await fetchSummary();
      return true;
    }
    return false;
  }

  Future<bool> changePassword(String oldPassword, String newPassword) async {
    final res = await ApiService.post(
      ApiConstants.changePassword,
      body: {'old_password': oldPassword, 'new_password': newPassword},
    );
    return res.success;
  }
}
