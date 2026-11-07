class CorrectionModel {
  final int id;
  final int employeeId;
  final String employeeCode;
  final String employeeName;
  final int shopId;
  final String shopName;
  final String shopCode;
  final String attendanceDate;
  final String eventType;
  final DateTime requestedTimestamp;
  final DateTime? originalTimestamp;
  final String reason;
  final String status;
  final String? reviewComments;
  final String? reviewedBy;

  CorrectionModel({
    required this.id,
    required this.employeeId,
    required this.employeeCode,
    required this.employeeName,
    required this.shopId,
    required this.shopName,
    required this.shopCode,
    required this.attendanceDate,
    required this.eventType,
    required this.requestedTimestamp,
    this.originalTimestamp,
    required this.reason,
    required this.status,
    this.reviewComments,
    this.reviewedBy,
  });

  bool get isPending => status == 'PENDING';

  factory CorrectionModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic val) {
      if (val == null) return null;
      try {
        return DateTime.parse(val.toString());
      } catch (_) {
        return null;
      }
    }

    return CorrectionModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      employeeId: json['employee_id'] is int ? json['employee_id'] : int.tryParse(json['employee_id']?.toString() ?? '0') ?? 0,
      employeeCode: json['employee_code']?.toString() ?? '',
      employeeName: json['employee_name']?.toString() ?? 'Employee',
      shopId: json['shop_id'] is int ? json['shop_id'] : int.tryParse(json['shop_id']?.toString() ?? '0') ?? 0,
      shopName: json['shop_name']?.toString() ?? '',
      shopCode: json['shop_code']?.toString() ?? '',
      attendanceDate: json['attendance_date']?.toString() ?? '',
      eventType: json['event_type']?.toString() ?? 'CHECK_IN',
      requestedTimestamp: parseDt(json['requested_timestamp']) ?? DateTime.now(),
      originalTimestamp: parseDt(json['original_timestamp']),
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      reviewComments: json['review_comments']?.toString(),
      reviewedBy: json['reviewed_by']?.toString(),
    );
  }
}

