class AuditLogModel {
  final int id;
  final String user;
  final String? role;
  final String action;
  final String details;
  final String createdAt;

  AuditLogModel({
    required this.id,
    required this.user,
    this.role,
    required this.action,
    required this.details,
    required this.createdAt,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) => AuditLogModel(
        id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
        user: json['user']?.toString() ?? 'System',
        role: json['role']?.toString(),
        action: json['action']?.toString() ?? '',
        details: json['details']?.toString() ?? '',
        createdAt: json['created_at']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user': user,
        'role': role,
        'action': action,
        'details': details,
        'created_at': createdAt,
      };
}

