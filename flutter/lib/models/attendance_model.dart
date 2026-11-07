import 'shop_model.dart';

class TodayStatusModel {
  final bool hasProfile;
  final String? employeeCode;
  final ShopModel? shop;
  final String today;
  final bool checkedIn;
  final DateTime? checkInTime;
  final bool checkedOut;
  final DateTime? checkOutTime;

  TodayStatusModel({
    required this.hasProfile,
    this.employeeCode,
    this.shop,
    required this.today,
    required this.checkedIn,
    this.checkInTime,
    required this.checkedOut,
    this.checkOutTime,
  });

  factory TodayStatusModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic val) {
      if (val == null) return null;
      try {
        return DateTime.parse(val.toString());
      } catch (_) {
        return null;
      }
    }

    return TodayStatusModel(
      hasProfile: json['has_profile'] == true,
      employeeCode: json['employee_code']?.toString(),
      shop: json['shop'] != null ? ShopModel.fromJson(json['shop']) : null,
      today: json['today']?.toString() ?? '',
      checkedIn: json['checked_in'] == true,
      checkInTime: parseDt(json['check_in_time']),
      checkedOut: json['checked_out'] == true,
      checkOutTime: parseDt(json['check_out_time']),
    );
  }
}

class AttendanceRecordModel {
  final int id;
  final String employeeName;
  final String employeeCode;
  final String shopName;
  final String workDate;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final String status;
  final String reviewStatus; // 'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'NONE'
  final String? reviewComments;
  final String? selfieDataUrl;
  final double? distanceM;

  AttendanceRecordModel({
    required this.id,
    required this.employeeName,
    required this.employeeCode,
    required this.shopName,
    required this.workDate,
    this.checkIn,
    this.checkOut,
    required this.status,
    required this.reviewStatus,
    this.reviewComments,
    this.selfieDataUrl,
    this.distanceM,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic val) {
      if (val == null) return null;
      try {
        return DateTime.parse(val.toString());
      } catch (_) {
        return null;
      }
    }

    String empName = '';
    String empCode = '';
    if (json['employee'] is Map<String, dynamic>) {
      empName = json['employee']['full_name']?.toString() ?? json['employee']['user']?['username']?.toString() ?? '';
      empCode = json['employee']['code']?.toString() ?? '';
    } else {
      empName = json['employee_name']?.toString() ?? '';
      empCode = json['employee_code']?.toString() ?? '';
    }

    String sName = '';
    if (json['shop'] is Map<String, dynamic>) {
      sName = json['shop']['name']?.toString() ?? '';
    } else {
      sName = json['shop_name']?.toString() ?? '';
    }

    return AttendanceRecordModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      employeeName: empName.isNotEmpty ? empName : 'Employee',
      employeeCode: empCode,
      shopName: sName.isNotEmpty ? sName : 'Assigned Shop',
      workDate: json['work_date']?.toString() ?? json['date']?.toString() ?? '',
      checkIn: parseDt(json['check_in']),
      checkOut: parseDt(json['check_out']),
      status: json['status']?.toString() ?? 'PRESENT',
      reviewStatus: json['review_status']?.toString() ?? json['status']?.toString() ?? 'NONE',
      reviewComments: json['review_comments']?.toString(),
      selfieDataUrl: json['selfie_data_url']?.toString(),
      distanceM: json['distance_m'] != null ? double.tryParse(json['distance_m'].toString()) : null,
    );
  }
}

