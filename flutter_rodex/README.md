# RODEX - Android AI Voice Assistant (Flutter APK)

This directory contains the standalone Flutter source project for RODEX, ready to open in Android Studio or VS Code and compile into an Android APK.

## Project Structure
- `pubspec.yaml`: Dependencies including `speech_to_text`, `flutter_tts`, `permission_handler`, and `http`.
- `android/app/src/main/AndroidManifest.xml`: Configured Android permissions (`RECORD_AUDIO`, `INTERNET`, `WAKE_LOCK`, `FOREGROUND_SERVICE_MICROPHONE`).
- `lib/main.dart`: Complete Flutter state machine with the glowing reactive neural orb, tap-to-talk speech recognition, and TTS audio synthesis.

## Quick Start
1. Ensure Flutter is installed:
   ```bash
   flutter doctor
   ```
2. Navigate to this directory:
   ```bash
   cd flutter_rodex
   flutter pub get
   ```
3. Run on your connected Android phone or emulator:
   ```bash
   flutter run
   ```
4. Build the standalone Release APK:
   ```bash
   flutter build apk --release
   ```
   The finished APK will be generated at:
   `build/app/outputs/flutter-apk/app-release.apk`
