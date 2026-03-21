/**
 * MidiInput — Web MIDI API wrapper for hardware MIDI controllers.
 * Designed for Akai MPK Mini but works with any class-compliant MIDI device.
 *
 * Fires callbacks on note on/off, CC changes, and device connect/disconnect.
 */

export interface MidiNoteEvent {
  note: number;       // MIDI note 0-127
  velocity: number;   // 0-127 (0 = note off)
  channel: number;    // 0-15
  timestamp: number;
}

export interface MidiCCEvent {
  controller: number; // CC number 0-127
  value: number;      // 0-127
  channel: number;
  timestamp: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

type NoteCallback = (event: MidiNoteEvent) => void;
type CCCallback = (event: MidiCCEvent) => void;
type DeviceCallback = (devices: MidiDevice[]) => void;

export class MidiInput {
  private midiAccess: MIDIAccess | null = null;
  private noteCallbacks: NoteCallback[] = [];
  private ccCallbacks: CCCallback[] = [];
  private deviceCallbacks: DeviceCallback[] = [];
  private connectedInputs: Map<string, MIDIInput> = new Map();
  private _devices: MidiDevice[] = [];

  get devices(): MidiDevice[] {
    return this._devices;
  }

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async start(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('MidiInput: Web MIDI API not supported in this browser');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

      // Listen for device changes
      this.midiAccess.onstatechange = () => this._refreshDevices();

      this._refreshDevices();
      this._connectAllInputs();

      return true;
    } catch (err) {
      console.warn('MidiInput: MIDI access denied or unavailable', err);
      return false;
    }
  }

  stop(): void {
    for (const [id, input] of this.connectedInputs) {
      input.onmidimessage = null;
      this.connectedInputs.delete(id);
    }
    this.midiAccess = null;
    this._devices = [];
  }

  onNote(cb: NoteCallback): () => void {
    this.noteCallbacks.push(cb);
    return () => {
      this.noteCallbacks = this.noteCallbacks.filter((c) => c !== cb);
    };
  }

  onCC(cb: CCCallback): () => void {
    this.ccCallbacks.push(cb);
    return () => {
      this.ccCallbacks = this.ccCallbacks.filter((c) => c !== cb);
    };
  }

  onDeviceChange(cb: DeviceCallback): () => void {
    this.deviceCallbacks.push(cb);
    return () => {
      this.deviceCallbacks = this.deviceCallbacks.filter((c) => c !== cb);
    };
  }

  private _refreshDevices(): void {
    if (!this.midiAccess) return;

    this._devices = [];
    for (const input of this.midiAccess.inputs.values()) {
      this._devices.push({
        id: input.id,
        name: input.name ?? 'Unknown MIDI Device',
        manufacturer: input.manufacturer ?? '',
      });
    }

    this._connectAllInputs();
    this.deviceCallbacks.forEach((cb) => cb(this._devices));
  }

  private _connectAllInputs(): void {
    if (!this.midiAccess) return;

    for (const input of this.midiAccess.inputs.values()) {
      if (!this.connectedInputs.has(input.id)) {
        input.onmidimessage = (e) => this._handleMessage(e);
        this.connectedInputs.set(input.id, input);
      }
    }
  }

  private _handleMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const channel = status & 0x0F;
    const command = status & 0xF0;

    switch (command) {
      case 0x90: { // Note On
        const note = data[1];
        const velocity = data.length > 2 ? data[2] : 0;
        const noteEvent: MidiNoteEvent = {
          note,
          velocity,
          channel,
          timestamp: event.timeStamp ?? performance.now(),
        };
        this.noteCallbacks.forEach((cb) => cb(noteEvent));
        break;
      }
      case 0x80: { // Note Off
        const note = data[1];
        const noteEvent: MidiNoteEvent = {
          note,
          velocity: 0,
          channel,
          timestamp: event.timeStamp ?? performance.now(),
        };
        this.noteCallbacks.forEach((cb) => cb(noteEvent));
        break;
      }
      case 0xB0: { // Control Change
        const controller = data[1];
        const value = data.length > 2 ? data[2] : 0;
        const ccEvent: MidiCCEvent = {
          controller,
          value,
          channel,
          timestamp: event.timeStamp ?? performance.now(),
        };
        this.ccCallbacks.forEach((cb) => cb(ccEvent));
        break;
      }
    }
  }
}
