import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class VoiceRecognitionService {
  private recognition: any = null;
  readonly isListening = signal<boolean>(false);
  readonly liveTranscript = signal<string>('');
  readonly isSupported = signal<boolean>(false);
  private isStarting = false;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.isSupported.set(true);
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        // Try Indian English first for terminology like 'rupees', 'lakh', 'SBI', 'UPI', 'Biryani'
        this.recognition.lang = 'en-IN';
      } catch (err) {
        console.warn('Could not initialize SpeechRecognition:', err);
        this.isSupported.set(false);
      }
    } else {
      this.isSupported.set(false);
    }
  }

  /**
   * Starts listening to user voice and resolves with final transcript string.
   */
  startListening(): Promise<string> {
    if (this.isListening() || this.isStarting) {
      // Already running or starting; prevent duplicate invocation
      return Promise.resolve('');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        this.initRecognition();
      }

      if (!this.recognition) {
        reject(
          new Error(
            'Speech recognition is not supported in this browser or environment.'
          )
        );
        return;
      }

      this.isStarting = true;
      this.liveTranscript.set('');
      let finalTranscript = '';
      let hasResolved = false;

      this.recognition.onstart = () => {
        this.isStarting = false;
        this.isListening.set(true);
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }
        this.liveTranscript.set(finalTranscript || interim);
      };

      this.recognition.onerror = (event: any) => {
        this.isStarting = false;
        this.isListening.set(false);
        if (!hasResolved) {
          hasResolved = true;
          let message = 'Voice recognition error.';
          if (event.error === 'not-allowed') {
            message = 'Microphone permission denied. Please allow microphone access in your browser or device settings.';
          } else if (event.error === 'no-speech') {
            message = 'No speech detected. Please tap and speak again.';
          } else if (event.error === 'network') {
            message = 'Network error during voice recognition. Please check your internet connection.';
          }
          reject(new Error(message));
        }
      };

      this.recognition.onend = () => {
        this.isStarting = false;
        this.isListening.set(false);
        if (!hasResolved) {
          hasResolved = true;
          const result = (finalTranscript || this.liveTranscript()).trim();
          if (result) {
            resolve(result);
          } else {
            reject(new Error('No speech was detected. Please try again.'));
          }
        }
      };

      try {
        this.recognition.start();
      } catch (err: any) {
        this.isStarting = false;
        if (err?.message?.includes('already started')) {
          this.isListening.set(true);
          return; // Already listening normally, no error needed
        }
        this.isListening.set(false);
        if (!hasResolved) {
          hasResolved = true;
          reject(err);
        }
      }
    });
  }

  /**
   * Stops active listening session.
   */
  stopListening() {
    this.isStarting = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
    this.isListening.set(false);
  }
}
