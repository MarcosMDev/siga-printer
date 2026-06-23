import { NativePrinter } from './native';
import type {
  ConnectionConfig,
  ConnectionStatus,
  DiscoveredDevice,
  ConnectionType,
} from '../types';

// ─────────────────────────────────────────────────────────────
//  ConnectionManager
//
//  Singleton that owns the printer connection lifecycle.
//  Survives component unmounts — state is global.
//
//  Usage:
//    import { printerManager } from 'siga-printer';
//
//    // Subscribe to state changes
//    const unsub = printerManager.subscribe(state => setMyState(state));
//
//    // Connect from a discovered device
//    await printerManager.connectDevice(device);
//
//    // Or from a raw config
//    await printerManager.connect({ type: 'usb' });
//
//    // Disconnect
//    await printerManager.disconnect();
// ─────────────────────────────────────────────────────────────

export type ConnectionManagerStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected';

export interface ConnectionManagerState {
  status: ConnectionManagerStatus;
  connectedDevice: DiscoveredDevice | null;
  config: ConnectionConfig | null;
  error: string | null;
  connectionStatus: ConnectionStatus | null;
  reconnectAttempt: number;
}

export interface ConnectionManagerOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  /** Base delay in ms; doubles each attempt (default: 1000) */
  reconnectDelay?: number;
}

type Listener = (state: ConnectionManagerState) => void;

const DEFAULT_OPTIONS: Required<ConnectionManagerOptions> = {
  autoReconnect: true,
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
};

export class PrinterConnectionManager {
  private _native: NativePrinter | null = null;
  private _options: Required<ConnectionManagerOptions>;
  private _listeners = new Set<Listener>();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private _state: ConnectionManagerState = {
    status: 'idle',
    connectedDevice: null,
    config: null,
    error: null,
    connectionStatus: null,
    reconnectAttempt: 0,
  };

  constructor(options: ConnectionManagerOptions = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ── Public state ─────────────────────────────────────────────

  getState(): ConnectionManagerState {
    return { ...this._state };
  }

  get isConnected(): boolean {
    return this._state.status === 'connected';
  }

  // ── Subscriptions ─────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    fn(this.getState());
    return () => this._listeners.delete(fn);
  }

  private _notify() {
    const s = this.getState();
    this._listeners.forEach(fn => fn(s));
  }

  private _setState(patch: Partial<ConnectionManagerState>) {
    this._state = { ...this._state, ...patch };
    this._notify();
  }

  // ── Connection ───────────────────────────────────────────────

  /**
   * Connect using a raw ConnectionConfig.
   * Pass an optional DiscoveredDevice for display purposes.
   */
  async connect(
    config: ConnectionConfig,
    device: DiscoveredDevice | null = null,
  ): Promise<void> {
    this._cancelReconnect();
    this._setState({
      status: 'connecting',
      config,
      connectedDevice: device,
      error: null,
      reconnectAttempt: 0,
    });

    try {
      if (!this._native) {
        this._native = new NativePrinter();
      }

      await this._native.connect(config);
      const connectionStatus = await this._native.getStatus();

      this._setState({
        status: 'connected',
        connectionStatus,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._setState({ status: 'error', error: msg });
      throw err;
    }
  }

  /**
   * Connect directly from a DiscoveredDevice.
   * Builds the ConnectionConfig automatically.
   */
  async connectDevice(device: DiscoveredDevice): Promise<void> {
    return this.connect(deviceToConfig(device), device);
  }

  async disconnect(): Promise<void> {
    this._cancelReconnect();
    try {
      await this._native?.disconnect();
    } finally {
      this._setState({
        status: 'disconnected',
        connectionStatus: null,
        error: null,
        reconnectAttempt: 0,
      });
    }
  }

  /**
   * Reconnect using the last known config.
   * Called automatically if autoReconnect is enabled.
   */
  async reconnect(): Promise<void> {
    if (!this._state.config) {
      throw new Error('[ConnectionManager] No previous config to reconnect with.');
    }
    return this.connect(this._state.config, this._state.connectedDevice);
  }

  /**
   * Refresh the connection status from the native module.
   */
  async refreshStatus(): Promise<ConnectionStatus | null> {
    if (!this._native || !this.isConnected) return null;
    try {
      const connectionStatus = await this._native.getStatus();
      this._setState({ connectionStatus });
      return connectionStatus;
    } catch {
      return null;
    }
  }

  /**
   * Configure options after construction.
   */
  configure(options: ConnectionManagerOptions) {
    this._options = { ...this._options, ...options };
  }

  // ── Auto-reconnect ───────────────────────────────────────────

  private _scheduleReconnect() {
    const { autoReconnect, maxReconnectAttempts, reconnectDelay } = this._options;
    const attempt = this._state.reconnectAttempt;

    if (!autoReconnect || !this._state.config) return;
    if (attempt >= maxReconnectAttempts) {
      this._setState({ status: 'error', error: 'Max reconnect attempts reached.' });
      return;
    }

    const delay = reconnectDelay * Math.pow(2, attempt);
    this._setState({ status: 'reconnecting', reconnectAttempt: attempt + 1 });

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this.reconnect();
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
  }

  private _cancelReconnect() {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

export function deviceToConfig(device: DiscoveredDevice): ConnectionConfig {
  switch (device.type as ConnectionType) {
    case 'usb':
      return {
        type: 'usb',
        vendorId: device.vendorId,
        productId: device.productId,
      };
    case 'bluetooth':
      return {
        type: 'bluetooth',
        address: device.address,
        name: device.name,
      };
    case 'tcp':
      return { type: 'tcp', host: device.address };
    case 'serial':
      return { type: 'serial', path: device.address };
  }
}

// ─────────────────────────────────────────────────────────────
//  Global singleton
// ─────────────────────────────────────────────────────────────
export const printerManager = new PrinterConnectionManager();
