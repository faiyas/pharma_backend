class EvidenceModel {
  final int id;
  final String employeeName;
  final String employeeCode;
  final String shopName;
  final String eventType;
  final String timestamp;
  final String? photoUrl;
  final double? distanceM;
  final bool accepted;

  EvidenceModel({
    required this.id,
    required this.employeeName,
    required this.employeeCode,
    required this.shopName,
    required this.eventType,
    required this.timestamp,
    this.photoUrl,
    this.distanceM,
    required this.accepted,
  });

  factory EvidenceModel.fromJson(Map<String, dynamic> json) {
    String empName = 'Employee';
    String empCode = '';
    if (json['employee'] is Map<String, dynamic>) {
      empName = json['employee']['name']?.toString() ?? json['employee']['user']?['username']?.toString() ?? 'Employee';
      empCode = json['employee']['code']?.toString() ?? '';
    } else if (json['employee_name'] != null) {
      empName = json['employee_name'].toString();
      empCode = json['employee_code']?.toString() ?? '';
    }

    String shop = 'Branch';
    if (json['shop'] is Map<String, dynamic>) {
      shop = json['shop']['name']?.toString() ?? 'Branch';
    } else if (json['shop_name'] != null) {
      shop = json['shop_name'].toString();
    }

    String? photo;
    if (json['photo'] is Map<String, dynamic>) {
      photo = json['photo']['url']?.toString() ?? json['photo']['image']?.toString();
    } else if (json['photo_url'] != null) {
      photo = json['photo_url'].toString();
    } else if (json['photo'] != null) {
      photo = json['photo'].toString();
    }

    return EvidenceModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      employeeName: empName,
      employeeCode: empCode,
      shopName: shop,
      eventType: json['event_type']?.toString() ?? 'CHECK_IN',
      timestamp: json['timestamp']?.toString() ?? '',
      photoUrl: photo,
      distanceM: json['distance_m'] is num
          ? (json['distance_m'] as num).toDouble()
          : double.tryParse(json['distance_m']?.toString() ?? ''),
      accepted: json['accepted'] == true,
    );
  }
}

