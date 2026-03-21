export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  /**
   * Start capturing audio from the microphone.
   * Optionally specify a deviceId to select a specific input device.
   */
  async start(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId } }
        : true,
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioContext = new AudioContext();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyserNode);

    this.destinationNode = this.audioContext.createMediaStreamDestination();
    this.sourceNode.connect(this.destinationNode);
  }

  /**
   * Stop capturing: disconnect nodes, stop media tracks, and close the context.
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.destinationNode = null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Return the current time-domain waveform as a Float32Array.
   */
  getTimeDomainData(): Float32Array {
    if (!this.analyserNode) {
      return new Float32Array(0);
    }
    const buffer = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(buffer);
    return buffer;
  }

  /**
   * Return the current frequency-domain data as a Float32Array (in dB).
   */
  getFrequencyData(): Float32Array {
    if (!this.analyserNode) {
      return new Float32Array(0);
    }
    const buffer = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(buffer);
    return buffer;
  }

  /**
   * Enumerate available audio input devices.
   */
  static async getInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }
}
