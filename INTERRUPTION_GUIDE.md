# Voice Chat Interruption Guide

## Overview

The voice chat implementation supports **natural interruptions** - you can interrupt the AI while it's speaking, just like a natural conversation.

## How Interruptions Work

### 1. Audio Level Monitoring

The AudioWorklet processor continuously monitors your microphone input:

```javascript
// Inside AudioWorklet (runs on audio rendering thread)
let sumSquares = 0
for (let i = 0; i < inputChannel.length; i++) {
  sumSquares += inputChannel[i] * inputChannel[i]
}
const rms = Math.sqrt(sumSquares / inputChannel.length)
```

**RMS (Root Mean Square)** provides a measure of audio signal strength:

- `0.0` = Silence
- `0.01-0.05` = Quiet speech
- `0.05-0.2` = Normal speech
- `0.2+` = Loud speech

### 2. AI Speaking State Tracking

The manager tracks when the AI is actively speaking:

```typescript
// When AI starts sending audio
case 'response.audio.delta':
  this.isAiSpeaking = true
  // ... play audio

// When AI finishes
case 'response.audio.done':
case 'response.done':
case 'response.cancelled':
  this.isAiSpeaking = false
```

### 3. Interruption Detection

On every audio frame (128 samples @ 24kHz ≈ 5.3ms), checks:

```typescript
if (
  this.interruptionEnabled &&
  this.isAiSpeaking &&
  audioLevel > this.interruptionThreshold
) {
  console.log('User interruption detected - canceling AI response')
  this.cancelResponse()
}
```

### 4. Cancellation

Sends `response.cancel` event to OpenAI:

```typescript
this.ws.send(
  JSON.stringify({
    type: 'response.cancel',
  })
)
this.isAiSpeaking = false
```

## Configuration

### Basic Usage

```typescript
import { useVoiceChat } from './hooks/use-voice-chat'

const voiceChat = useVoiceChat({
  selectedGame,
  onError: handleError,
})

// Configure interruptions
voiceChat.setInterruptionConfig({
  enabled: true,
  threshold: 0.01,
})
```

### Sensitivity Tuning

Different environments require different thresholds:

#### Quiet Office/Home (Default)

```typescript
voiceChat.setInterruptionConfig({ threshold: 0.01 })
```

- Works well in controlled environments
- Minimal background noise
- Natural conversation feel

#### Noisy Environment

```typescript
voiceChat.setInterruptionConfig({ threshold: 0.02 })
```

- Reduces false interruptions from ambient noise
- Requires slightly louder speech
- Good for gaming with background music

#### Very Noisy (Gaming Cafe, etc)

```typescript
voiceChat.setInterruptionConfig({ threshold: 0.05 })
```

- Requires clear, loud speech to interrupt
- Prevents accidental interruptions
- May feel less responsive

#### Push-to-Talk Mode (Disable Interruptions)

```typescript
voiceChat.setInterruptionConfig({ enabled: false })
```

- Traditional turn-based conversation
- AI must finish before you can speak
- Prevents accidental interruptions

## Advanced Configuration

### Dynamic Threshold Adjustment

Adjust threshold based on detected noise floor:

```typescript
// Measure ambient noise level
let noiseFloor = 0
const samples = []

// Collect 1 second of "silence"
const measureNoise = setInterval(() => {
  // Get current audio level from worklet
  samples.push(currentAudioLevel)

  if (samples.length >= 100) {
    noiseFloor = Math.max(...samples) * 1.5 // 50% above max noise
    voiceChat.setInterruptionConfig({ threshold: noiseFloor })
    clearInterval(measureNoise)
  }
}, 10)
```

### Context-Aware Interruptions

Only allow interruptions during certain AI responses:

```typescript
let allowInterruptions = true

// Disable interruptions during important AI messages
if (aiMessageIsImportant) {
  voiceChat.setInterruptionConfig({ enabled: false })
  allowInterruptions = false
}

// Re-enable after message completes
onAiResponseComplete(() => {
  if (!allowInterruptions) {
    voiceChat.setInterruptionConfig({ enabled: true })
  }
})
```

### Debouncing

Prevent rapid interruption/re-interruption:

```typescript
let lastInterruptionTime = 0
const INTERRUPTION_COOLDOWN = 1000 // 1 second

const customInterruptionCheck = (audioLevel: number) => {
  const now = Date.now()
  if (
    audioLevel > threshold &&
    now - lastInterruptionTime > INTERRUPTION_COOLDOWN
  ) {
    lastInterruptionTime = now
    voiceChat.cancelResponse()
  }
}
```

## Testing Interruptions

### 1. Visual Feedback Test

Add visual indicator when interruption is detected:

```typescript
// In your component
const [isInterrupting, setIsInterrupting] = useState(false)

// Listen for interruptions
useEffect(() => {
  const handleInterruption = () => {
    setIsInterrupting(true)
    setTimeout(() => setIsInterrupting(false), 500)
  }

  // You'd need to expose this event from the manager
  voiceChat.onInterruption(handleInterruption)
}, [])

// Show indicator
{isInterrupting && (
  <div className="interruption-indicator">
    🛑 Interrupting...
  </div>
)}
```

### 2. Threshold Testing

Test different thresholds to find optimal value:

```typescript
const testThresholds = [0.005, 0.01, 0.02, 0.05]
let currentIndex = 0

const cycleThreshold = () => {
  currentIndex = (currentIndex + 1) % testThresholds.length
  const threshold = testThresholds[currentIndex]
  voiceChat.setInterruptionConfig({ threshold })
  console.log(`Testing threshold: ${threshold}`)
}

// Press a key to cycle through thresholds
window.addEventListener('keypress', (e) => {
  if (e.key === 't') cycleThreshold()
})
```

### 3. Audio Level Monitoring

Log audio levels to find patterns:

```typescript
// You'd need to expose this from the worklet
voiceChat.onAudioLevel((level) => {
  console.log(`Current audio level: ${level.toFixed(4)}`)

  // Visual meter
  const barWidth = Math.min(level * 1000, 100)
  console.log(`[${'█'.repeat(barWidth)}${' '.repeat(100 - barWidth)}]`)
})
```

## Troubleshooting

### Problem: Too Many False Interruptions

**Symptoms:**

- AI gets interrupted by background noise
- Keyboard typing triggers interruptions
- Music/game sounds cause cancellations

**Solutions:**

1. Increase threshold: `setInterruptionConfig({ threshold: 0.02 })`
2. Improve microphone setup (noise gate, positioning)
3. Use push-to-talk mode temporarily
4. Add noise floor calibration

### Problem: Can't Interrupt AI

**Symptoms:**

- Speaking doesn't interrupt AI
- Have to wait for AI to finish

**Solutions:**

1. Lower threshold: `setInterruptionConfig({ threshold: 0.005 })`
2. Speak louder/closer to microphone
3. Check if interruptions are enabled
4. Verify microphone input is working

### Problem: Delayed Interruption Response

**Symptoms:**

- AI continues speaking for 0.5-1 second after interruption
- Feels unresponsive

**Causes:**

- Audio buffering in playback queue
- Network latency to OpenAI
- WebSocket message processing delay

**Solutions:**

1. This is expected behavior (network round-trip time)
2. Reduce audio buffer size (already optimized with AudioWorklet)
3. Consider faster internet connection

### Problem: Interruptions Work Inconsistently

**Symptoms:**

- Sometimes interrupts, sometimes doesn't
- Random behavior

**Solutions:**

1. Check microphone is not being muted/unmuted
2. Verify audio levels are consistent
3. Check browser console for errors
4. Test with different threshold values

## Best Practices

### 1. User Preference

Allow users to configure their own threshold:

```typescript
// In settings UI
<Slider
  label="Interruption Sensitivity"
  min={0.005}
  max={0.05}
  step={0.005}
  value={interruptionThreshold}
  onChange={(value) => {
    voiceChat.setInterruptionConfig({ threshold: value })
    localStorage.setItem('interruption-threshold', value)
  }}
/>
```

### 2. Per-Game Configuration

Different games might need different settings:

```typescript
const gameInterruptionConfig = {
  'Elden Ring': { threshold: 0.01 }, // Quiet, focused gameplay
  Valorant: { threshold: 0.03 }, // Loud, action-packed
  Chess: { threshold: 0.005 }, // Very quiet
}

const config = gameInterruptionConfig[selectedGame.name]
voiceChat.setInterruptionConfig(config)
```

### 3. Visual Feedback

Always show when interruption occurs:

```typescript
// Show visual indicator
onInterruption(() => {
  showNotification('Interrupting AI...', { duration: 500 })
})
```

### 4. Graceful Degradation

If interruptions cause problems, allow disabling:

```typescript
// In settings
<Toggle
  label="Allow Interruptions"
  checked={interruptionsEnabled}
  onChange={(enabled) => {
    voiceChat.setInterruptionConfig({ enabled })
  }}
/>
```

## Performance Impact

- **CPU**: Minimal (RMS calculation is very fast)
- **Memory**: None (no additional buffers)
- **Latency**: ~5-10ms (single audio frame processing)
- **Network**: No impact (only changes when interruption occurs)

Interruption detection adds virtually no overhead to the voice chat system.

## Future Enhancements

Potential improvements:

1. **Adaptive Threshold**: Automatically adjust based on noise floor
2. **Multi-level Detection**: Different thresholds for different interruption urgency
3. **Visual Audio Meter**: Show user their audio level in real-time
4. **Interruption Analytics**: Track and optimize interruption patterns
5. **Smart Interruption**: Only allow during natural pauses in AI speech
