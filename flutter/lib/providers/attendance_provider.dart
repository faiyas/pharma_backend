import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../config/api_constants.dart';
import '../models/attendance_model.dart';
import '../models/shop_model.dart';
import '../services/api_service.dart';
import '../services/camera_service.dart';
import '../services/location_service.dart';

class AttendanceProvider extends ChangeNotifier {
  TodayStatusModel? _todayStatus;
  List<AttendanceRecordModel> _history = [];
  bool _isLoading = false;
  bool _isPunching = false;
  String? _errorMessage;

  // Live Location & Geofencing
  Position? _currentPosition;
  double? _distanceToShopM;
  bool _isWithinGeofence = false;
  bool _isFetchingLocation = false;
  String? _locationError;

  // Selfie capture
  File? _selfieFile;
  String? _selfieBase64DataUrl;

  TodayStatusModel? get todayStatus => _todayStatus;
  List<AttendanceRecordModel> get history => _history;
  bool get isLoading => _isLoading;
  bool get isPunching => _isPunching;
  String? get errorMessage => _errorMessage;

  Position? get currentPosition => _currentPosition;
  double? get distanceToShopM => _distanceToShopM;
  bool get isWithinGeofence => _isWithinGeofence;
  bool get isFetchingLocation => _isFetchingLocation;
  String? get locationError => _locationError;

  File? get selfieFile => _selfieFile;
  String? get selfieBase64DataUrl => _selfieBase64DataUrl;
  bool get hasSelfie => _selfieBase64DataUrl != null;

  Future<void> fetchTodayStatus() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.todayStatus);
      if (res.success && res.data is Map<String, dynamic>) {
        _todayStatus = TodayStatusModel.fromJson(res.data);
        if (_todayStatus?.shop != null) {
          await checkLocationAndGeofence(_todayStatus!.shop!);
        }
      } else {
        _errorMessage = res.errorMessage;
      }
    } catch (e) {
      _errorMessage = 'Failed to load today status: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkLocationAndGeofence(ShopModel shop) async {
    _isFetchingLocation = true;
    _locationError = null;
    notifyListeners();

    try {
      final res = await LocationService.getCurrentLocation();
      if (res.isSuccess) {
        _currentPosition = res.position;
        _distanceToShopM = LocationService.calculateDistance(
          _currentPosition!.latitude,
          _currentPosition!.longitude,
          shop.latitude,
          shop.longitude,
        );
        _isWithinGeofence = _distanceToShopM! <= shop.allowedRadiusM;
      } else {
        _locationError = res.errorMessage;
        _distanceToShopM = null;
        _isWithinGeofence = false;
      }
    } catch (e) {
      _locationError = 'Error checking GPS: $e';
      _isWithinGeofence = false;
    } finally {
      _isFetchingLocation = false;
      notifyListeners();
    }
  }

  Future<bool> captureSelfie() async {
    final result = await CameraService.captureFrontSelfie();
    if (result.isSuccess) {
      _selfieFile = result.file;
      _selfieBase64DataUrl = result.base64DataUrl;
      notifyListeners();
      return true;
    } else {
      _errorMessage = result.errorMessage;
      notifyListeners();
      return false;
    }
  }

  void clearSelfie() {
    _selfieFile = null;
    _selfieBase64DataUrl = null;
    notifyListeners();
  }

  Future<bool> submitPunch({required String eventType}) async {
    if (_todayStatus?.shop == null) {
      _errorMessage = 'No assigned pharmacy branch found.';
      notifyListeners();
      return false;
    }

    if (_currentPosition == null) {
      _errorMessage = 'GPS coordinates are missing. Please tap "Refresh GPS".';
      notifyListeners();
      return false;
    }

    if (_selfieBase64DataUrl == null) {
      _errorMessage = 'A camera selfie is required before punching.';
      notifyListeners();
      return false;
    }

    _isPunching = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final payload = {
        'latitude': _currentPosition!.latitude,
        'longitude': _currentPosition!.longitude,
        'gps_accuracy_m': _currentPosition!.accuracy,
        'event_type': eventType, // 'CHECK_IN' or 'CHECK_OUT'
        'selfie_data_url': _selfieBase64DataUrl,
      };

      final res = await ApiService.post(ApiConstants.submitPunch, body: payload);

      if (res.success) {
        clearSelfie();
        await fetchTodayStatus();
        await fetchHistory();
        _isPunching = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'Punch rejected.';
        _isPunching = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Punch failed: $e';
      _isPunching = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> fetchHistory() async {
    try {
      final res = await ApiService.get(ApiConstants.attendanceRecords);
      if (res.success && res.data is List) {
        _history = (res.data as List)
            .map((item) => AttendanceRecordModel.fromJson(item as Map<String, dynamic>))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }
}

