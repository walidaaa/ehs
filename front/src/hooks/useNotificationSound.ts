import { useCallback } from "react";

// Create notification sound using Web Audio API (similar to Messenger)
const createNotificationSound = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioContext;
};

export const useNotificationSound = () => {
  const audioContextRef = useCallback(() => {
    return createNotificationSound();
  }, []);

  const playMessageSound = useCallback(() => {
    try {
      const audioContext = audioContextRef();
      if (!audioContext) return;

      // Shorter, more pleasant notification sound (single note)
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Pleasant notification sound - two short tones
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.setValueAtTime(1000, now + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch (err) {
      console.error("[v0] Notification sound error:", err);
    }
  }, [audioContextRef]);

  const playReceivedMessageSound = useCallback(() => {
    try {
      const audioContext = audioContextRef();
      if (!audioContext) return;

      // Received message sound - double beep
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Two-tone notification
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.setValueAtTime(800, now + 0.08);
      
      gainNode.gain.setValueAtTime(0.25, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch (err) {
      console.error("[v0] Notification sound error:", err);
    }
  }, [audioContextRef]);

  return {
    playMessageSound,
    playReceivedMessageSound,
  };
};
