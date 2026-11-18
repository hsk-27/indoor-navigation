import { SpeechPriority } from './NavigationContext';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface VoiceOptions {
    priority?: SpeechPriority;
    force?: boolean;
    rate?: number;
    pitch?: number;
    lang?: string;
}

export class VoiceGuidanceService {
    private static instance: VoiceGuidanceService;
    private muted: boolean = false;
    private currentPriority: SpeechPriority | null = null;
    private lastSpokenText: string = '';
    private lastSpokenTime: number = 0;
    private isSpeaking: boolean = false;
    private language: string = 'en-US';
    private defaultRate: number = 1.0;
    private defaultPitch: number = 1.0;
    private readonly COOLDOWN_MS = 2500;
    private listeners: ((muted: boolean) => void)[] = [];

    private constructor() {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('nav_voice_muted');
            if (saved !== null) {
                this.muted = saved === 'true';
            }
        }

        if (Capacitor.isNativePlatform()) {
            LocalNotifications.requestPermissions().catch(console.error);
        }
    }

    public static getInstance(): VoiceGuidanceService {
        if (!VoiceGuidanceService.instance) {
            VoiceGuidanceService.instance = new VoiceGuidanceService();
        }
        return VoiceGuidanceService.instance;
    }

    public isMuted(): boolean {
        return this.muted;
    }

    public setMuted(muted: boolean): void {
        this.muted = muted;
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('nav_voice_muted', String(muted));
        }
        if (muted) {
            this.stop();
        }
        this.listeners.forEach(cb => cb(this.muted));
    }

    public toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }

    public onMuteChange(listener: (muted: boolean) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public setLanguage(lang: string): void {
        this.language = lang;
    }

    public setVoiceParams(rate?: number, pitch?: number): void {
        if (rate !== undefined) this.defaultRate = rate;
        if (pitch !== undefined) this.defaultPitch = pitch;
    }

    /**
     * Speaks the given announcement obeying priority levels:
     * - HIGH: Preempts/interrupts any active speech immediately (e.g. Recalculation, Return, Low confidence).
     * - MEDIUM: Preempts LOW priority speech (e.g. Turn now, Arrived).
     * - LOW: Only speaks if no higher priority message is playing and cooldown elapsed.
     */
    public speak(text: string, options: VoiceOptions = {}): boolean {
        if (!text || text.trim().length === 0) return false;

        const priority: SpeechPriority = options.priority || 'LOW';
        const now = Date.now();

        // Check if identical instruction was just spoken recently
        if (!options.force && text === this.lastSpokenText && (now - this.lastSpokenTime) < this.COOLDOWN_MS) {
            return false;
        }

        // Send a native OS notification on mobile devices for this instruction
        if (Capacitor.isNativePlatform()) {
            LocalNotifications.schedule({
                notifications: [
                    {
                        title: "Navigation Instruction",
                        body: text,
                        id: Date.now() % 100000,
                        schedule: { at: new Date(Date.now() + 100) }, // Trigger almost immediately
                    }
                ]
            }).catch(console.error);
        }

        if (this.muted) {
            // Even if muted, we sent the notification. But don't speak.
            this.lastSpokenText = text;
            this.lastSpokenTime = now;
            this.currentPriority = priority;
            return true;
        }

        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            // Non-browser / headless test environment fallback
            this.lastSpokenText = text;
            this.lastSpokenTime = now;
            this.currentPriority = priority;
            return true;
        }

        const synth = window.speechSynthesis;

        // Priority Evaluation:
        // HIGH can interrupt anything.
        // MEDIUM can interrupt LOW.
        // LOW cannot interrupt MEDIUM or HIGH while speaking.
        if (this.isSpeaking && this.currentPriority) {
            if (priority === 'HIGH') {
                synth.cancel();
            } else if (priority === 'MEDIUM' && this.currentPriority === 'LOW') {
                synth.cancel();
            } else if (priority === 'LOW' && (this.currentPriority === 'HIGH' || this.currentPriority === 'MEDIUM')) {
                // Cannot preempt active higher priority speech
                return false;
            }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate ?? this.defaultRate;
        utterance.pitch = options.pitch ?? this.defaultPitch;
        utterance.lang = options.lang ?? this.language;

        this.currentPriority = priority;
        this.lastSpokenText = text;
        this.lastSpokenTime = now;
        this.isSpeaking = true;

        utterance.onend = () => {
            this.isSpeaking = false;
            this.currentPriority = null;
        };

        utterance.onerror = (e) => {
            console.warn('[VoiceGuidanceService] Speech synthesis error:', e);
            this.isSpeaking = false;
            this.currentPriority = null;
        };

        synth.speak(utterance);
        return true;
    }

    public stop(): void {
        this.isSpeaking = false;
        this.currentPriority = null;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    public cancel(): void {
        this.stop();
    }

    public getLastSpokenText(): string {
        return this.lastSpokenText;
    }
}
