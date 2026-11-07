class ShopModel {
  final int id;
  final String name;
  final String code;
  final String address;
  final double latitude;
  final double longitude;
  final double allowedRadiusM;

  ShopModel({
    required this.id,
    required this.name,
    required this.code,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.allowedRadiusM,
  });

  factory ShopModel.fromJson(Map<String, dynamic> json) {
    return ShopModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      latitude: json['latitude'] is num ? (json['latitude'] as num).toDouble() : double.tryParse(json['latitude']?.toString() ?? '0.0') ?? 0.0,
      longitude: json['longitude'] is num ? (json['longitude'] as num).toDouble() : double.tryParse(json['longitude']?.toString() ?? '0.0') ?? 0.0,
      allowedRadiusM: json['allowed_radius_m'] is num
          ? (json['allowed_radius_m'] as num).toDouble()
          : double.tryParse(json['allowed_radius_m']?.toString() ?? '100.0') ?? 100.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'allowed_radius_m': allowedRadiusM,
  };
}

