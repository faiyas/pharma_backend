import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';

class StorageService {
  static SharedPreferences? _prefs;

  static const String _keyAccess = 'access_token';
  static const String _keyRefresh = 'refresh_token';
  static const String _keyUser = 'cached_user';
  static const String _keyCustomBaseUrl = 'custom_base_url';

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  static String? getCustomBaseUrl() => _prefs?.getString(_keyCustomBaseUrl);

  static Future<void> setCustomBaseUrl(String? url) async {
    if (url == null || url.trim().isEmpty) {
      await _prefs?.remove(_keyCustomBaseUrl);
    } else {
      await _prefs?.setString(_keyCustomBaseUrl, url.trim());
    }
  }

  static Future<void> saveTokens({required String access, String? refresh}) async {
    await _prefs?.setString(_keyAccess, access);
    if (refresh != null) {
      await _prefs?.setString(_keyRefresh, refresh);
    }
  }

  static Future<String?> getAccessToken() async {
    return _prefs?.getString(_keyAccess);
  }

  static Future<String?> getRefreshToken() async {
    return _prefs?.getString(_keyRefresh);
  }

  static Future<void> saveUser(UserModel user) async {
    await _prefs?.setString(_keyUser, jsonEncode(user.toJson()));
  }

  static Future<UserModel?> getCachedUser() async {
    final str = _prefs?.getString(_keyUser);
    if (str == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(str));
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearAll() async {
    await _prefs?.remove(_keyAccess);
    await _prefs?.remove(_keyRefresh);
    await _prefs?.remove(_keyUser);
  }
}
