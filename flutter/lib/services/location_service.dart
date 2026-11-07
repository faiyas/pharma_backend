import 'package:geolocator/geolocator.dart';

class LocationResult {
  final Position? position;
  final String? errorMessage;
  final bool isPermissionDenied;

  LocationResult({
    this.position,
    this.errorMessage,
    this.isPermissionDenied = false,
  });

  bool get isSuccess => position != null;
}

class LocationService {
  static Future<LocationResult> getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationResult(
        errorMessage: 'Location services are disabled on your phone. Please turn on GPS.',
      );
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return LocationResult(
          errorMessage: 'Location permission was denied. GPS is required for geofenced attendance.',
          isPermissionDenied: true,
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return LocationResult(
        errorMessage: 'Location permissions are permanently denied. Please enable them in app settings.',
        isPermissionDenied: true,
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      return LocationResult(position: position);
    } catch (e) {
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          return LocationResult(position: last);
        }
      } catch (_) {}
      return LocationResult(
        errorMessage: 'Could not obtain precise GPS position: $e',
      );
    }
  }

  static double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }

  static bool isWithinGeofence({
    required double deviceLat,
    required double deviceLon,
    required double shopLat,
    required double shopLon,
    required double allowedRadiusM,
  }) {
    final distance = calculateDistance(deviceLat, deviceLon, shopLat, shopLon);
    return distance <= allowedRadiusM;
  }
}

