import 'dart:convert';
import 'dart:io';
import 'package:image_picker/image_picker.dart';

class SelfieResult {
  final File? file;
  final String? base64DataUrl;
  final String? errorMessage;

  SelfieResult({this.file, this.base64DataUrl, this.errorMessage});

  bool get isSuccess => file != null && base64DataUrl != null;
}

class CameraService {
  static final ImagePicker _picker = ImagePicker();

  static Future<SelfieResult> captureFrontSelfie() async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 720,
        maxHeight: 720,
        imageQuality: 70, // Ensures file size stays well within the 500KB backend limit
      );

      if (photo == null) {
        return SelfieResult(errorMessage: 'Selfie capture was cancelled.');
      }

      final file = File(photo.path);
      final bytes = await file.readAsBytes();
      final base64Str = base64Encode(bytes);
      final dataUrl = 'data:image/jpeg;base64,$base64Str';

      return SelfieResult(
        file: file,
        base64DataUrl: dataUrl,
      );
    } catch (e) {
      return SelfieResult(errorMessage: 'Camera error: $e');
    }
  }
}

