import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_constants.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  bool _initialized = false;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;
  bool get isInitialized => _initialized;

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await StorageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        final res = await ApiService.get(ApiConstants.me);
        if (res.success && res.data is Map<String, dynamic>) {
          _currentUser = UserModel.fromJson(res.data);
          await StorageService.saveUser(_currentUser!);
        } else {
          _currentUser = await StorageService.getCachedUser();
        }
      }
    } catch (_) {
      _currentUser = await StorageService.getCachedUser();
    } finally {
      _isLoading = false;
      _initialized = true;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await http.post(
        Uri.parse(ApiConstants.token),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username.trim(),
          'password': password,
        }),
      );

      dynamic body;
      try {
        body = jsonDecode(res.body);
      } catch (_) {
        body = {};
      }

      if (res.statusCode == 200 && body is Map && body.containsKey('access')) {
        await StorageService.saveTokens(
          access: body['access'].toString(),
          refresh: body['refresh']?.toString(),
        );

        final profileRes = await ApiService.get(ApiConstants.me);
        if (profileRes.success && profileRes.data is Map<String, dynamic>) {
          _currentUser = UserModel.fromJson(profileRes.data);
          await StorageService.saveUser(_currentUser!);
        } else {
          _currentUser = UserModel(
            id: 0,
            username: username.trim(),
            email: '',
            role: 'EMPLOYEE',
          );
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = body is Map && body.containsKey('detail')
            ? body['detail'].toString()
            : 'Invalid username or password.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Could not reach server: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> updateServerUrl(String? url) async {
    await StorageService.setCustomBaseUrl(url);
    notifyListeners();
  }

  Future<void> logout() async {
    await StorageService.clearAll();
    _currentUser = null;
    notifyListeners();
  }
}

