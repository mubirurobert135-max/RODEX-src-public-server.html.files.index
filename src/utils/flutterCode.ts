// Pre-packaged production Flutter files for direct compilation into an Android APK

export const FLUTTER_PUBSPEC = `name: rodex
description: "RODEX - Advanced AI Voice Assistant Android App"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  speech_to_text: ^6.6.1
  flutter_tts: ^3.8.5
  permission_handler: ^11.3.1
  http: ^1.2.0
  google_fonts: ^6.1.0
  cupertino_icons: ^1.0.6

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`;

export const FLUTTER_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.rodex.ai.assistant">

    <!-- Permissions required for RODEX Voice Assistant -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

    <application
        android:label="RODEX"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/LaunchTheme"
        android:hardwareAccelerated="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:windowSoftInputMode="adjustResize">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
            
            <!-- Voice Assistant Intent Filter for Android OS -->
            <intent-filter>
                <action android:name="android.intent.action.VOICE_COMMAND" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>
        
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>
`;

export const FLUTTER_MAIN = `import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:math' as math;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.black,
  ));
  runApp(const RodexApp());
}

class RodexApp extends StatelessWidget {
  const RodexApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RODEX',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF06B6D4),
          surface: Colors.black,
        ),
      ),
      home: const RodexHomeScreen(),
    );
  }
}

enum AssistantState { idle, listening, thinking, speaking }

class RodexHomeScreen extends StatefulWidget {
  const RodexHomeScreen({super.key});

  @override
  State<RodexHomeScreen> createState() => _RodexHomeScreenState();
}

class _RodexHomeScreenState extends State<RodexHomeScreen>
    with SingleTickerProviderStateMixin {
  AssistantState _state = AssistantState.idle;
  late stt.SpeechToText _speech;
  late FlutterTts _tts;
  late AnimationController _animController;

  String _transcript = '';
  String _lastResponse = 'Tap the microphone to speak to RODEX.';
  final List<Map<String, String>> _messages = [];
  bool _speechAvailable = false;

  // Replace with your backend server URL or Gemini API Key
  final String _backendUrl = 'https://YOUR_BACKEND_URL/api/chat';

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();
    _tts = FlutterTts();
    _initTts();
    _initSpeech();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  void _initTts() async {
    await _tts.setLanguage("en-US");
    await _tts.setPitch(1.0);
    await _tts.setSpeechRate(0.5);

    _tts.setStartHandler(() {
      setState(() => _state = AssistantState.speaking);
    });

    _tts.setCompletionHandler(() {
      setState(() => _state = AssistantState.idle);
    });

    _tts.setErrorHandler((msg) {
      setState(() => _state = AssistantState.idle);
    });
  }

  void _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onError: (val) => setState(() => _state = AssistantState.idle),
      onStatus: (val) {
        if (val == 'done' || val == 'notListening') {
          if (_state == AssistantState.listening) {
            _onSpeechFinished();
          }
        }
      },
    );
    setState(() {});
  }

  void _toggleListening() async {
    if (_state == AssistantState.listening) {
      await _speech.stop();
      _onSpeechFinished();
    } else if (_state == AssistantState.speaking) {
      await _tts.stop();
      setState(() => _state = AssistantState.idle);
    } else {
      if (!_speechAvailable) {
        _initSpeech();
      }
      setState(() {
        _state = AssistantState.listening;
        _transcript = '';
      });
      await _speech.listen(
        onResult: (val) {
          setState(() {
            _transcript = val.recognizedWords;
          });
        },
      );
    }
  }

  void _onSpeechFinished() async {
    if (_transcript.trim().isEmpty) {
      setState(() => _state = AssistantState.idle);
      return;
    }

    final userText = _transcript;
    setState(() {
      _messages.add({'sender': 'user', 'text': userText});
      _state = AssistantState.thinking;
    });

    try {
      final response = await http.post(
        Uri.parse(_backendUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'message': userText}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final reply = data['reply'] ?? 'RODEX response received.';
        _handleAiResponse(reply);
      } else {
        _handleAiResponse('RODEX was unable to reach the neural core.');
      }
    } catch (e) {
      _handleAiResponse("I am RODEX. Neural link ready, please verify network connection.");
    }
  }

  void _handleAiResponse(String reply) async {
    setState(() {
      _lastResponse = reply;
      _messages.add({'sender': 'assistant', 'text': reply});
      _state = AssistantState.speaking;
    });
    await _tts.speak(reply);
  }

  @override
  void dispose() {
    _animController.dispose();
    _speech.stop();
    _tts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF06B6D4),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'RODEX',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2.0,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _state.name.toUpperCase(),
                    style: TextStyle(
                      color: _state == AssistantState.listening
                          ? const Color(0xFF06B6D4)
                          : _state == AssistantState.thinking
                              ? const Color(0xFF10B981)
                              : Colors.white54,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),

            // Main AI Orb Centerpiece
            Expanded(
              child: Center(
                child: AnimatedBuilder(
                  animation: _animController,
                  builder: (context, child) {
                    double scale = 1.0;
                    if (_state == AssistantState.speaking) {
                      scale = 1.0 + 0.1 * math.sin(_animController.value * 2 * math.pi * 2);
                    } else if (_state == AssistantState.listening) {
                      scale = 1.05 + 0.08 * math.sin(_animController.value * 2 * math.pi * 3);
                    }

                    return Transform.scale(
                      scale: scale,
                      child: Container(
                        width: 240,
                        height: 240,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const RadialGradient(
                            colors: [
                              Color(0xFF06B6D4), // Cyan
                              Color(0xFF0D9488), // Teal
                              Color(0xFF10B981), // Green
                              Color(0xFF1D4ED8), // Deep Blue
                              Colors.black,
                            ],
                            stops: [0.0, 0.35, 0.65, 0.88, 1.0],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF06B6D4).withOpacity(0.4),
                              blurRadius: 50,
                              spreadRadius: 10,
                            ),
                            BoxShadow(
                              color: const Color(0xFF10B981).withOpacity(0.2),
                              blurRadius: 80,
                              spreadRadius: 20,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),

            // Live Caption / Subtitle
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                _state == AssistantState.listening
                    ? (_transcript.isEmpty ? 'Listening...' : _transcript)
                    : _lastResponse,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ),

            const SizedBox(height: 30),

            // Bottom Voice Microphone Button
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: GestureDetector(
                onTap: _toggleListening,
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _state == AssistantState.listening
                        ? const Color(0xFF06B6D4)
                        : const Color(0xFF111827),
                    border: Border.all(
                      color: const Color(0xFF06B6D4),
                      width: 2,
                    ),
                    boxShadow: [
                      if (_state == AssistantState.listening)
                        BoxShadow(
                          color: const Color(0xFF06B6D4).withOpacity(0.6),
                          blurRadius: 24,
                          spreadRadius: 4,
                        ),
                    ],
                  ),
                  child: Icon(
                    _state == AssistantState.listening
                        ? Icons.mic
                        : _state == AssistantState.speaking
                            ? Icons.volume_up
                            : Icons.mic_none,
                    color: _state == AssistantState.listening
                        ? Colors.black
                        : const Color(0xFF06B6D4),
                    size: 32,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
`;

export const FLUTTER_RUN_INSTRUCTIONS = `# How to Run & Build the RODEX Android APK

### Step 1: Install Flutter
Ensure you have the Flutter SDK installed on your computer.
Verify by opening your terminal and running:
\`flutter doctor\`

### Step 2: Create a Flutter Project
In your terminal, navigate to your desired directory:
\`flutter create rodex\`
\`cd rodex\`

### Step 3: Replace Files
Copy the provided Flutter code into your project:
1. Replace \`pubspec.yaml\` with the provided dependencies (\`speech_to_text\`, \`flutter_tts\`, etc.).
2. Replace \`android/app/src/main/AndroidManifest.xml\` with the provided permissions.
3. Replace \`lib/main.dart\` with the provided RODEX mobile app code.

### Step 4: Install Dependencies
Run:
\`flutter pub get\`

### Step 5: Test on an Android Emulator or Phone
Enable USB Debugging on your Android phone and plug it in, or start an Android Virtual Device (AVD).
Run:
\`flutter run\`

### Step 6: Build the Release APK
To generate a stand-alone APK file that can be installed on any Android phone:
\`flutter build apk --release\`

The generated APK will be available at:
\`build/app/outputs/flutter-apk/app-release.apk\`
`;
