class ManagedShopInfo {
  final int id;
  final String name;
  final String code;

  ManagedShopInfo({
    required this.id,
    required this.name,
    required this.code,
  });

  factory ManagedShopInfo.fromJson(Map<String, dynamic> json) => ManagedShopInfo(
        id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
        name: json['name']?.toString() ?? '',
        code: json['code']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'code': code,
      };
}

class ManagerAccountModel {
  final int id;
  final String username;
  final String dateJoined;
  final List<ManagedShopInfo> managedShops;

  ManagerAccountModel({
    required this.id,
    required this.username,
    required this.dateJoined,
    required this.managedShops,
  });

  factory ManagerAccountModel.fromJson(Map<String, dynamic> json) => ManagerAccountModel(
        id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
        username: json['username']?.toString() ?? '',
        dateJoined: json['date_joined']?.toString() ?? '',
        managedShops: (json['managed_shops'] as List? ?? [])
            .map((s) => ManagedShopInfo.fromJson(s as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'date_joined': dateJoined,
        'managed_shops': managedShops.map((s) => s.toJson()).toList(),
      };
}

