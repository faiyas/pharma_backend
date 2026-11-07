class LeaveModel {
  final int id;
  final String employeeName;
  final String employeeCode;
  final String leaveType;
  final String startDate;
  final String endDate;
  final int totalDays;
  final String reason;
  final String status; // 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  final String? managerComments;
  final DateTime? createdAt;

  LeaveModel({
    required this.id,
    required this.employeeName,
    required this.employeeCode,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    this.managerComments,
    this.createdAt,
  });

  bool get isPending => status == 'PENDING';
  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';

  factory LeaveModel.fromJson(Map<String, dynamic> json) {
    String empName = '';
    String empCode = '';
    if (json['employee'] is Map<String, dynamic>) {
      empName = json['employee']['full_name']?.toString() ?? json['employee']['user']?['username']?.toString() ?? '';
      empCode = json['employee']['code']?.toString() ?? '';
    } else {
      empName = json['employee_name']?.toString() ?? '';
      empCode = json['employee_code']?.toString() ?? '';
    }

    DateTime? parseDt(dynamic val) {
      if (val == null) return null;
      try {
        return DateTime.parse(val.toString());
      } catch (_) {
        return null;
      }
    }

    return LeaveModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      employeeName: empName.isNotEmpty ? empName : 'Staff Member',
      employeeCode: empCode,
      leaveType: json['leave_type']?.toString() ?? 'CASUAL',
      startDate: json['start_date']?.toString() ?? '',
      endDate: json['end_date']?.toString() ?? '',
      totalDays: json['total_days'] is int
          ? json['total_days']
          : int.tryParse(json['total_days']?.toString() ?? '1') ?? 1,
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString().toUpperCase() ?? 'PENDING',
      managerComments: json['comments']?.toString() ?? json['manager_comments']?.toString(),
      createdAt: parseDt(json['created_at']),
    );
  }
}

class LeaveBalanceModel {
  final String leaveType;
  final int allocated;
  final int used;
  final int remaining;

  LeaveBalanceModel({
    required this.leaveType,
    required this.allocated,
    required this.used,
    required this.remaining,
  });

  factory LeaveBalanceModel.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => v is int ? v : int.tryParse(v?.toString() ?? '0') ?? 0;
    return LeaveBalanceModel(
      leaveType: json['leave_type']?.toString() ?? '',
      allocated: toInt(json['allocated_days'] ?? json['allocated']),
      used: toInt(json['used_days'] ?? json['used']),
      remaining: toInt(json['remaining_days'] ?? json['remaining']),
    );
  }
}

