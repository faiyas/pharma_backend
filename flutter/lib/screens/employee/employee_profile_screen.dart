import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class EmployeeProfileScreen extends StatefulWidget {
  final bool isFirstTimeSetup;

  const EmployeeProfileScreen({super.key, this.isFirstTimeSetup = false});

  @override
  State<EmployeeProfileScreen> createState() => _EmployeeProfileScreenState();
}

class _EmployeeProfileScreenState extends State<EmployeeProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _oldPassCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  DateTime? _dob;
  bool _isLoading = false;
  bool _obscureOld = true;
  bool _obscureNew = true;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    if (user != null) {
      _fullNameCtrl.text = user.fullName ?? '';
      _emailCtrl.text = user.email;
    }
  }

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _emailCtrl.dispose();
    _oldPassCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1950),
      lastDate: DateTime.now().subtract(const Duration(days: 5844)), // At least 16yo
    );
    if (picked != null) {
      setState(() => _dob = picked);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    if (_newPassCtrl.text != _confirmPassCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match.'), backgroundColor: AppTheme.danger),
      );
      return;
    }

    final isFirstTime = widget.isFirstTimeSetup || (context.read<AuthProvider>().currentUser?.mustChangePassword == true);

    if (isFirstTime && _dob == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select your Date of Birth.'), backgroundColor: AppTheme.danger),
      );
      return;
    }

    setState(() => _isLoading = true);

    final auth = context.read<AuthProvider>();
    final dobStr = _dob != null ? DateFormat('yyyy-MM-dd').format(_dob!) : null;

    final success = await auth.changePassword(
      oldPassword: _oldPassCtrl.text.trim(),
      newPassword: _newPassCtrl.text.trim(),
      fullName: isFirstTime ? _fullNameCtrl.text.trim() : null,
      email: isFirstTime ? _emailCtrl.text.trim() : null,
      dateOfBirth: dobStr,
    );

    setState(() => _isLoading = false);

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile and password updated successfully!'),
            backgroundColor: AppTheme.success,
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(auth.errorMessage ?? 'Failed to update password.'),
            backgroundColor: AppTheme.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final isFirstTime = widget.isFirstTimeSetup || (user?.mustChangePassword == true);

    return Scaffold(
      appBar: AppBar(
        title: Text(isFirstTime ? 'Complete Account Setup' : 'Profile & Security'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isFirstTime) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.warning.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: AppTheme.warning, size: 28),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'Initial setup required: Please fill in your personal details and set a private secure password (8+ characters).',
                          style: TextStyle(fontSize: 13, color: AppTheme.textMain),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _fullNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Full Name *',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Full name is required.' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address *',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (v) => v == null || !v.contains('@') ? 'Valid email is required.' : null,
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  icon: const Icon(Icons.cake_outlined),
                  label: Text(_dob != null ? 'DOB: ${DateFormat('yyyy-MM-dd').format(_dob!)}' : 'Select Date of Birth (DOB) *'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    alignment: Alignment.centerLeft,
                  ),
                  onPressed: _pickDob,
                ),
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _oldPassCtrl,
                obscureText: _obscureOld,
                decoration: InputDecoration(
                  labelText: isFirstTime ? 'Temporary Password (e.g. 1234) *' : 'Current Password *',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureOld ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscureOld = !_obscureOld),
                  ),
                ),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _newPassCtrl,
                obscureText: _obscureNew,
                decoration: InputDecoration(
                  labelText: 'New Password (8+ characters) *',
                  prefixIcon: const Icon(Icons.lock_reset),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureNew ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscureNew = !_obscureNew),
                  ),
                ),
                validator: (v) => v == null || v.length < 8 ? 'Must be at least 8 characters.' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _confirmPassCtrl,
                obscureText: _obscureNew,
                decoration: const InputDecoration(
                  labelText: 'Confirm New Password *',
                  prefixIcon: Icon(Icons.check_circle_outline),
                ),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                icon: _isLoading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.save),
                label: Text(
                  _isLoading
                      ? 'Saving...'
                      : isFirstTime
                          ? 'Activate My Profile & Save Password'
                          : 'Update Password',
                ),
                onPressed: _isLoading ? null : _saveProfile,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

