import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_constants.dart';
import 'storage_service.dart';

class ApiResponse {
  final bool success;
  final int statusCode;
  final dynamic data;
  final String? errorMessage;

  ApiResponse({
    required this.success,
    required this.statusCode,
    this.data,
    this.errorMessage,
  });
}

class ApiService {
  static Future<Map<String, String>> _getHeaders({bool includeAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (includeAuth) {
      final token = await StorageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  static String _extractError(dynamic body, int statusCode) {
    if (body is Map<String, dynamic>) {
      if (body.containsKey('detail')) return body['detail'].toString();
      if (body.containsKey('message')) return body['message'].toString();
      if (body.containsKey('error')) return body['error'].toString();

      final errors = <String>[];
      body.forEach((key, value) {
        if (value is List) {
          errors.add('$key: ${value.join(", ")}');
        } else {
          errors.add('$key: $value');
        }
      });
      if (errors.isNotEmpty) return errors.join(' | ');
    }
    return 'Server error ($statusCode)';
  }

  static Future<bool> _tryRefreshToken() async {
    final refresh = await StorageService.getRefreshToken();
    if (refresh == null) return false;

    try {
      final res = await http.post(
        Uri.parse(ApiConstants.tokenRefresh),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': refresh}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data.containsKey('access')) {
          await StorageService.saveTokens(
            access: data['access'].toString(),
            refresh: data['refresh']?.toString() ?? refresh,
          );
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  static Future<ApiResponse> get(String url, {bool retryOn401 = true}) async {
    try {
      final headers = await _getHeaders();
      final res = await http.get(Uri.parse(url), headers: headers);

      if (res.statusCode == 401 && retryOn401) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          return get(url, retryOn401: false);
        }
      }

      dynamic body;
      try {
        body = jsonDecode(res.body);
      } catch (_) {
        body = res.body;
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return ApiResponse(success: true, statusCode: res.statusCode, data: body);
      } else {
        return ApiResponse(
          success: false,
          statusCode: res.statusCode,
          errorMessage: _extractError(body, res.statusCode),
        );
      }
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 0,
        errorMessage: 'Network connection failed: $e',
      );
    }
  }

  static Future<ApiResponse> post(String url, {Map<String, dynamic>? body, bool retryOn401 = true}) async {
    try {
      final headers = await _getHeaders();
      final res = await http.post(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );

      if (res.statusCode == 401 && retryOn401) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          return post(url, body: body, retryOn401: false);
        }
      }

      dynamic data;
      try {
        data = jsonDecode(res.body);
      } catch (_) {
        data = res.body;
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return ApiResponse(success: true, statusCode: res.statusCode, data: data);
      } else {
        return ApiResponse(
          success: false,
          statusCode: res.statusCode,
          errorMessage: _extractError(data, res.statusCode),
        );
      }
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 0,
        errorMessage: 'Network connection failed: $e',
      );
    }
  }
}

