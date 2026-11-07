import 'package:flutter/material.dart';
import '../config/api_constants.dart';
import '../models/leave_model.dart';
import '../services/api_service.dart';

class LeaveProvider extends ChangeNotifier {
  List<LeaveModel> _leaves = [];
  List<LeaveBalanceModel> _balances = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<LeaveModel> get leaves => _leaves;
  List<LeaveBalanceModel> get balances => _balances;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<LeaveModel> get pendingLeaves =>
      _leaves.where((l) => l.isPending).toList();

  Future<void> fetchLeaves() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.leaves);
      if (res.success && res.data is List) {
        _leaves = (res.data as List)
            .map((item) => LeaveModel.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        _errorMessage = res.errorMessage;
      }
    } catch (e) {
      _errorMessage = 'Failed to load leaves: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchBalances() async {
    try {
      final res = await ApiService.get(ApiConstants.leaveBalances);
      if (res.success && res.data is List) {
        _balances = (res.data as List)
            .map((item) => LeaveBalanceModel.fromJson(item as Map<String, dynamic>))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<bool> applyLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final payload = {
        'leave_type': leaveType,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason.trim(),
      };

      final res = await ApiService.post(ApiConstants.leaves, body: payload);

      if (res.success) {
        await fetchLeaves();
        await fetchBalances();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'Failed to apply leave.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Application error: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> approveLeave(int leaveId, {String comments = ''}) async {
    try {
      final res = await ApiService.post(
        ApiConstants.leaveApprove(leaveId),
        body: {'comments': comments},
      );
      if (res.success) {
        await fetchLeaves();
        return true;
      } else {
        _errorMessage = res.errorMessage;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Approve failed: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> rejectLeave(int leaveId, {String comments = ''}) async {
    try {
      final res = await ApiService.post(
        ApiConstants.leaveReject(leaveId),
        body: {'comments': comments},
      );
      if (res.success) {
        await fetchLeaves();
        return true;
      } else {
        _errorMessage = res.errorMessage;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Reject failed: $e';
      notifyListeners();
      return false;
    }
  }
}

