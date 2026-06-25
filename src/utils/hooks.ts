import { useState, useEffect, useCallback, useRef } from 'react';
import { ThermalPrinter, ConnectedThermalPrinter } from '../builder/ThermalPrinter';
import { PrinterDiscovery } from '../connection/discovery';
import { printerManager } from '../connection/ConnectionManager';
import type {
  ConnectionConfig,
  ConnectionStatus,
  DiscoveredDevice,
  PrintResult,
  ThermalPrinterOptions,
} from '../types';
import type {
  ConnectionManagerState,
  ConnectionManagerOptions,
} from '../connection/ConnectionManager';

// ─────────────────────────────────────────────────────────────
//  usePrinter
//
//  React hook that manages the full printer lifecycle:
//    connect → print → disconnect
//
//  Usage:
//    const { connect, print, status, isConnected } = usePrinter();
//
//    await connect({ type: 'usb' });
//
//    await print(async (p) => {
//      await p.init().text('Olá!').cut().print();
//    });
// ─────────────────────────────────────────────────────────────

type PrinterState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'printing'
  | 'error'
  | 'disconnected';

export interface UsePrinterReturn {
  /** Current lifecycle state */
  state:       PrinterState;
  isConnected: boolean;
  isPrinting:  boolean;
  error:       string | null;
  status:      ConnectionStatus | null;

  /** Connect to a printer */
  connect:    (config: ConnectionConfig, options?: ThermalPrinterOptions) => Promise<void>;
  /** Disconnect */
  disconnect: () => Promise<void>;

  /**
   * Build and print in one call.
   * The callback receives the connected printer for chaining.
   */
  print: (
    buildFn: (printer: ConnectedThermalPrinter) => Promise<PrintResult>,
  ) => Promise<PrintResult>;

  /** Raw printer instance (null if not connected) */
  printer: ConnectedThermalPrinter | null;
}

export function usePrinter(): UsePrinterReturn {
  const [state,  setState ] = useState<PrinterState>('idle');
  const [error,  setError ] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  const printerRef = useRef<ConnectedThermalPrinter | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      printerRef.current?.disconnect().catch(() => {});
    };
  }, []);

  const connect = useCallback(async (
    config:  ConnectionConfig,
    options?: ThermalPrinterOptions,
  ) => {
    setState('connecting');
    setError(null);

    try {
      const printer = await ThermalPrinter.connect(config, options);
      printerRef.current = printer;

      const s = await printer.getStatus();
      setStatus(s);
      setState('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setState('error');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await printerRef.current?.disconnect();
    } finally {
      printerRef.current = null;
      setState('disconnected');
      setStatus(null);
    }
  }, []);

  const print = useCallback(async (
    buildFn: (printer: ConnectedThermalPrinter) => Promise<PrintResult>,
  ): Promise<PrintResult> => {
    if (!printerRef.current) {
      throw new Error('Printer not connected. Call connect() first.');
    }

    setState('printing');
    setError(null);

    try {
      const result = await buildFn(printerRef.current);
      setState('connected');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setState('error');
      throw err;
    }
  }, []);

  return {
    state,
    isConnected: state === 'connected' || state === 'printing',
    isPrinting:  state === 'printing',
    error,
    status,
    connect,
    disconnect,
    print,
    printer: printerRef.current,
  };
}

// ─────────────────────────────────────────────────────────────
//  useDiscovery
//  Hook for scanning for available printers
// ─────────────────────────────────────────────────────────────

export interface UseDiscoveryReturn {
  devices:    DiscoveredDevice[];
  scanning:   boolean;
  error:      string | null;
  scan:       (timeoutMs?: number) => Promise<void>;
  scanUSB:    () => Promise<void>;
  scanBT:     () => Promise<void>;
  scanTCP:    () => Promise<void>;
  clear:      () => void;
}

export function useDiscovery(): UseDiscoveryReturn {
  const [devices,  setDevices ] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error,    setError   ] = useState<string | null>(null);

  const discovery = useRef(new PrinterDiscovery());

  const runScan = useCallback(async (fn: () => Promise<DiscoveredDevice[]>) => {
    setScanning(true);
    setError(null);
    try {
      const found = await fn();
      setDevices(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  return {
    devices,
    scanning,
    error,
    scan:    (t) => runScan(() => discovery.current.discoverAll(t)),
    scanUSB: ()  => runScan(() => discovery.current.discoverEpsonUSB()),
    scanBT:  ()  => runScan(() => discovery.current.discoverBluetooth()),
    scanTCP: ()  => runScan(() => discovery.current.discoverNetwork()),
    clear:   ()  => setDevices([]),
  };
}

// ─────────────────────────────────────────────────────────────
//  useConnectionManager
//
//  Reactive access to the global PrinterConnectionManager
//  singleton. State persists across component mount/unmount.
//
//  Usage:
//    const { status, connectedDevice, connectDevice, disconnect } =
//      useConnectionManager();
// ─────────────────────────────────────────────────────────────

export interface UseConnectionManagerReturn extends ConnectionManagerState {
  isConnected: boolean;
  connectDevice: (device: DiscoveredDevice) => Promise<void>;
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  configure: (options: ConnectionManagerOptions) => void;
}

export function useConnectionManager(): UseConnectionManagerReturn {
  const [state, setState] = useState<ConnectionManagerState>(
    () => printerManager.getState(),
  );

  useEffect(() => {
    return printerManager.subscribe(setState);
  }, []);

  return {
    ...state,
    isConnected: printerManager.isConnected,
    connectDevice: useCallback(
      (device: DiscoveredDevice) => printerManager.connectDevice(device),
      [],
    ),
    connect: useCallback(
      (config: ConnectionConfig) => printerManager.connect(config),
      [],
    ),
    disconnect: useCallback(() => printerManager.disconnect(), []),
    reconnect: useCallback(() => printerManager.reconnect(), []),
    configure: useCallback(
      (options: ConnectionManagerOptions) => printerManager.configure(options),
      [],
    ),
  };
}
