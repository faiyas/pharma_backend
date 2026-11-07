class EmployeeModel {
  final int id;
  final String code;
  final String username;
  final String fullName;
  final String email;
  final String phone;
  final String designation;
  final String employmentStatus;
  final bool isActive;
  final int shopId;
  final String shopName;
  final String shopCode;
  final String dateJoined;

  EmployeeModel({
    required this.id,
    required this.code,
    required this.username,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.designation,
    required this.employmentStatus,
    required this.isActive,
    required this.shopId,
    required this.shopName,
    required this.shopCode,
    required this.dateJoined,
  });

  factory EmployeeModel.fromJson(Map<String, dynamic> json) {
    return EmployeeModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      code: json['code']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? json['username']?.toString() ?? 'Employee',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      designation: json['designation']?.toString() ?? 'Staff',
      employmentStatus: json['employment_status']?.toString() ?? (json['is_active'] == true ? 'ACTIVE' : 'INACTIVE'),
      isActive: json['is_active'] == true || json['employment_status'] == 'ACTIVE',
      shopId: json['shop_id'] is int ? json['shop_id'] : int.tryParse(json['shop_id']?.toString() ?? '0') ?? 0,
      shopName: json['shop_name']?.toString() ?? '',
      shopCode: json['shop_code']?.toString() ?? '',
      dateJoined: json['date_joined']?.toString() ?? '',
    );
  }
}

