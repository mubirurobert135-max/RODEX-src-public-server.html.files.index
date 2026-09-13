import 'package:flutter/material.dart';
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
  String _lastResponse = 'Tap the microphone or orb to converse with RODEX.';
  final List<Map<String, String>> _messages = [];
  bool _speechAvailable = false;
  bool _isLiveConversation = false;

  // Set this to your live server endpoint or AI Studio URL
  final String _backendUrl = 'https://YOUR_AI_STUDIO_APP_URL/api/chat';

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
      if (_isLiveConversation) {
        Future.delayed(const Duration(milliseconds: 350), () {
          if (_isLiveConversation && _state == AssistantState.idle) {
            _toggleListening();
          }
        });
      }
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

    final userText = _transcript.trim();
    final lower = userText.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), '');
    final isHeyRodex = RegExp(r'^(hey\s+rodex|hi\s+rodex|hello\s+rodex|rodex|call\s+hey\s+rodex)$').hasMatch(lower);

    // Direct wake-word handling: "Hey RODEX" -> "Hlo Mr Robert"
    if (isHeyRodex) {
      _isLiveConversation = true;
      setState(() {
        _messages.add({
          'sender': 'user',
          'text': userText,
          'speaker': 'Mr. Robert',
        });
        _lastResponse = 'Hlo Mr Robert';
        _messages.add({
          'sender': 'assistant',
          'text': 'Hlo Mr Robert! I am listening. How can I assist you today?',
        });
        _state = AssistantState.speaking;
      });
      await _tts.speak('Hlo Mr Robert');
      return;
    }

    setState(() {
      _messages.add({
        'sender': 'user',
        'text': userText,
        'speaker': 'Mr. Robert',
      });
      _state = AssistantState.thinking;
    });

    try {
      final response = await http.post(
        Uri.parse(_backendUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'message': userText,
          'customInstruction': 'The user is Mr. Robert. You recognize his voice. Address him as Mr. Robert.',
          'liveConversation': _isLiveConversation,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final reply = data['reply'] ?? 'RODEX response received.';
        _handleAiResponse(reply);
      } else {
        _handleAiResponse('RODEX was unable to reach the neural core.');
      }
    } catch (e) {
      _handleAiResponse(
          "I am RODEX. System link active. Configure your backend URL to receive live Gemini responses.");
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
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
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
                      const SizedBox(width: 10),
                      const Text(
                        'RODEX',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 3.0,
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
                              : Colors.white38,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.0,
                    ),
                  ),
                ],
              ),
            ),

            // Center Glowing AI Orb
            Expanded(
              child: Center(
                child: GestureDetector(
                  onTap: _toggleListening,
                  child: AnimatedBuilder(
                    animation: _animController,
                    builder: (context, child) {
                      double scale = 1.0;
                      if (_state == AssistantState.speaking) {
                        scale = 1.0 + 0.08 * math.sin(_animController.value * 2 * math.pi * 2);
                      } else if (_state == AssistantState.listening) {
                        scale = 1.05 + 0.06 * math.sin(_animController.value * 2 * math.pi * 3);
                      }

                      return Transform.scale(
                        scale: scale,
                        child: CustomPaint(
                          painter: OrbSoundwavePainter(
                            state: _state,
                            animationProgress: _animController.value,
                          ),
                          child: Container(
                            width: 250,
                            height: 250,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const RadialGradient(
                                colors: [
                                  Color(0xFF67E8F9), // Light Cyan
                                  Color(0xFF06B6D4), // Cyan
                                  Color(0xFF0D9488), // Teal
                                  Color(0xFF10B981), // Emerald
                                  Color(0xFF1D4ED8), // Deep Blue
                                  Colors.black,
                                ],
                                stops: [0.0, 0.25, 0.5, 0.75, 0.92, 1.0],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF06B6D4).withOpacity(0.4),
                                  blurRadius: 60,
                                  spreadRadius: 10,
                                ),
                                BoxShadow(
                                  color: const Color(0xFF10B981).withOpacity(0.2),
                                  blurRadius: 90,
                                  spreadRadius: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),

            // Live Caption Subtitle
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Text(
                _state == AssistantState.listening
                    ? (_transcript.isEmpty ? 'Listening...' : _transcript)
                    : _lastResponse,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Tap-To-Talk Button
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: GestureDetector(
                onTap: _toggleListening,
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _state == AssistantState.listening
                        ? const Color(0xFF06B6D4)
                        : const Color(0xFF0A0A0A),
                    border: Border.all(
                      color: const Color(0xFF06B6D4),
                      width: 2,
                    ),
                    boxShadow: [
                      if (_state == AssistantState.listening)
                        BoxShadow(
                          color: const Color(0xFF06B6D4).withOpacity(0.7),
                          blurRadius: 30,
                          spreadRadius: 6,
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
                    size: 34,
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

/// Dynamic, frequency-dependent soundwave bars around the periphery of the AI Orb
class OrbSoundwavePainter extends CustomPainter {
  final AssistantState state;
  final double animationProgress;

  OrbSoundwavePainter({
    required this.state,
    required this.animationProgress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final orbRadius = size.width / 2;
    final innerRadius = orbRadius + 4;
    const numBars = 54;
    final t = animationProgress * 2 * math.pi;

    final isListening = state == AssistantState.listening;
    final isSpeaking = state == AssistantState.speaking;
    final isActive = isListening || isSpeaking;

    for (int i = 0; i < numBars; i++) {
      final angle = (i / numBars) * 2 * math.pi - math.pi / 2;
      final normalizedAngle = (angle + math.pi / 2 + 2 * math.pi) % (2 * math.pi);
      final freqNorm = 1.0 - (normalizedAngle - math.pi).abs() / math.pi;

      // Frequency simulation waves
      final bassWave = math.sin(t * 2.5 + i * 0.15) * 0.6 + math.cos(t * 1.5 + i * 0.1) * 0.4;
      final vocalWave = math.sin(t * 6.0 + i * 0.4) * math.cos(t * 3.5 - i * 0.25);
      final trebleWave = (math.sin(t * 12.0 + i * 0.8) + math.cos(t * 18.0 + i * 1.2)) * 0.5;

      double freqWave;
      if (freqNorm < 0.35) {
        freqWave = bassWave;
      } else if (freqNorm < 0.75) {
        freqWave = vocalWave;
      } else {
        freqWave = trebleWave;
      }

      final travelingWave = math.sin(t * 4.0 - angle * 3.0) * 0.3;
      final wave = (freqWave + travelingWave + 1.2) / 2.2;

      double barHeight;
      if (isActive) {
        barHeight = 5.0 + wave * (isListening ? 26.0 : 20.0);
      } else {
        barHeight = 3.0 + (math.sin(t * 2.0 + angle * 2.0) * 0.5 + 0.5) * 4.0;
      }

      final outerRadius = innerRadius + barHeight;
      final p1 = Offset(center.dx + math.cos(angle) * innerRadius, center.dy + math.sin(angle) * innerRadius);
      final p2 = Offset(center.dx + math.cos(angle) * outerRadius, center.dy + math.sin(angle) * outerRadius);

      final paint = Paint()
        ..strokeWidth = isActive ? 2.5 : 1.5
        ..strokeCap = StrokeCap.round
        ..shader = ui.Gradient.linear(
          p1,
          p2,
          isListening
              ? [const Color(0xFF06B6D4).withOpacity(0.4), const Color(0xFF22D3EE), Colors.white]
              : isSpeaking
                  ? [const Color(0xFF0D9488).withOpacity(0.4), const Color(0xFF10B981), const Color(0xFFA7F3D0)]
                  : [const Color(0xFF06B6D4).withOpacity(0.2), const Color(0xFF22D3EE).withOpacity(0.5)],
        );

      canvas.drawLine(p1, p2, paint);
    }
  }

  @override
  bool shouldRepaint(covariant OrbSoundwavePainter oldDelegate) {
    return oldDelegate.animationProgress != animationProgress || oldDelegate.state != state;
  }
}

