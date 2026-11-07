import 'shop_model.dart';

class UserModel {
  final int id;
  final String username;
  final String email;
  final String role; // 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'
  final String? fullName;
  final String? employeeCode;
  final ShopModel? assignedShop;

  UserModel({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    this.fullName,
    this.employeeCode,
    this.assignedShop,
  });

  bool get isEmployee => role == 'EMPLOYEE';
  bool get isManager => role == 'MANAGER';
  bool get isAdmin => role == 'SUPER_ADMIN';
  bool get isStaffLeader => isManager || isAdmin;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    ShopModel? shop;
    String? empCode;
    String? name = json['full_name']?.toString() ?? json['first_name']?.toString();

    if (json['employee'] != null && json['employee'] is Map<String, dynamic>) {
      final emp = json['employee'] as Map<String, dynamic>;
      empCode = emp['code']?.toString();
      name ??= emp['full_name']?.toString();
      if (emp['shop'] != null && emp['shop'] is Map<String, dynamic>) {
        shop = ShopModel.fromJson(emp['shop'] as Map<String, dynamic>);
      }
    } else if (json['shop'] != null && json['shop'] is Map<String, dynamic>) {
      shop = ShopModel.fromJson(json['shop'] as Map<String, dynamic>);
    }

    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString().toUpperCase() ?? 'EMPLOYEE',
      fullName: name?.isNotEmpty == true ? name : json['username']?.toString(),
      employeeCode: empCode,
      assignedShop: shop,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'email': email,
    'role': role,
    'full_name': fullName,
    'employee_code': employeeCode,
    'shop': assignedShop?.toJson(),
  };
}

