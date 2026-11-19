import { Injectable, signal } from '@angular/core';

export interface VoiceResult {
  text: string;
  audioBase64: string;
  mimeType: string;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceRecognitionService {
  private recognition: any = null;
  readonly isListening = signal<boolean>(false);
  readonly liveTranscript = signal<string>('');
  readonly isSupported = signal<boolean>(true);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private isStarting = false;

  constructor() {}

  private getSupportedAudioMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return '';
  }

  private startWebSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      this.stopWebSpeechRecognition();
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = 'en-IN';

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        this.liveTranscript.set(final || interim);
      };

      rec.onerror = (e: any) => {
        // Silently handle web speech errors since MediaRecorder audio + Whisper is the primary engine
        console.warn('SpeechRecognition error (fallback to MediaRecorder):', e?.error);
      };

      rec.onend = () => {
        // Speech ended
      };

      rec.start();
      this.recognition = rec;
    } catch (err) {
      console.warn('SpeechRecognition start failed (safely ignored):', err);
      this.recognition = null;
    }
  }

  private stopWebSpeechRecognition() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
  }

  /**
   * Starts listening:
   * 1. Records audio via MediaRecorder (works on 100% of mobile Android / iOS devices).
   * 2. Runs SpeechRecognition in parallel if supported (provides live feedback on desktop Chrome).
   */
  async startListening(): Promise<void> {
    if (this.isListening() || this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.liveTranscript.set('');
    this.audioChunks = [];

    // 1. Start audio recording via getUserMedia (standard HTML5 Audio)
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        const mimeType = this.getSupportedAudioMimeType();
        const options = mimeType ? { mimeType } : undefined;

        if (typeof MediaRecorder !== 'undefined') {
          this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

          this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
              this.audioChunks.push(event.data);
            }
          };

          this.mediaRecorder.start(250);
        }
      }
    } catch (err) {
      console.warn('getUserMedia mic error:', err);
    }

    // 2. Start SpeechRecognition in parallel for live interim preview if supported
    this.startWebSpeechRecognition();

    this.isStarting = false;
    this.isListening.set(true);
  }

  /**
   * Stops recording and returns transcript and/or base64 audio payload.
   */
  stopListening(): Promise<VoiceResult> {
    return new Promise((resolve) => {
      this.isStarting = false;
      this.isListening.set(false);
      this.stopWebSpeechRecognition();

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const usedMime = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: usedMime });

          // Release microphone tracks immediately so Android status bar mic icon closes
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
          }
          this.mediaRecorder = null;

          if (audioBlob.size === 0) {
            resolve({
              text: this.liveTranscript().trim(),
              audioBase64: '',
              mimeType: usedMime,
            });
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const resultStr = (reader.result as string) || '';
            const base64Data = resultStr.includes(',')
              ? resultStr.split(',')[1]
              : resultStr;

            resolve({
              text: this.liveTranscript().trim(),
              audioBase64: base64Data,
              mimeType: usedMime,
            });
          };
          reader.readAsDataURL(audioBlob);
        };

        try {
          this.mediaRecorder.stop();
        } catch (_) {
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
          }
          this.mediaRecorder = null;
          resolve({
            text: this.liveTranscript().trim(),
            audioBase64: '',
            mimeType: 'audio/webm',
          });
        }
      } else {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((t) => t.stop());
          this.mediaStream = null;
        }
        this.mediaRecorder = null;
        resolve({
          text: this.liveTranscript().trim(),
          audioBase64: '',
          mimeType: 'audio/webm',
        });
      }
    });
  }

  /**
   * Cancels any active listening and releases microphone hardware.
   */
  cancelListening() {
    this.isStarting = false;
    this.isListening.set(false);
    this.stopWebSpeechRecognition();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.liveTranscript.set('');
  }
}
