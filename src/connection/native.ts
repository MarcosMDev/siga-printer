import { NativeModules, TurboModuleRegistry, Platform } from 'react-native';
import type {
  ConnectionConfig,
  ConnectionStatus,
  CashDrawerOptions,
  PrintResult,
  DiscoveredDevice,
  ConnectionType,
} from '../types';

// ─────────────────────────────────────────────────────────────
//  NativePrinter
//
//  Bridges to the Android/iOS native module.
//  Supports both:
//    - Old Architecture (NativeModules bridge)
//    - New Architecture (TurboModule via TurboModuleRegistry)
//
//  The TurboModule spec is in NativeRNThermalPrinter.ts (codegen).
// ─────────────────────────────────────────────────────────────

const MODULE_NAME = 'RNThermalPrinter';

function getNativeModule() {
  // New Architecture: TurboModule
  if (TurboModuleRegistry) {
    try {
      const turbo = TurboModuleRegistry.getEnforcing<any>(MODULE_NAME);
      if (turbo) return turbo;
    } catch (_) {}
  }

  // Old Architecture: NativeModules bridge
  const mod = NativeModules[MODULE_NAME];
  if (mod) return mod;

  throw new Error(
    `[ThermalPrinter] Native module "${MODULE_NAME}" not found. ` +
    'Did you run `pod install` (iOS) or rebuild the Android project? ' +
    'See the README for installation instructions.',
  );
}

export class NativePrinter {
  private mod: any;

  constructor() {
    this.mod = getNativeModule();
  }

  // ── Connection ───────────────────────────────────────────────

  async connect(config: ConnectionConfig): Promise<boolean> {
    if (Platform.OS === 'android' && config.type === 'usb') {
      const usbCfg = config as any;
      const hasPermission = await this.requestUSBPermission(
        usbCfg.vendorId  ?? 0x04b8, // Epson default
        usbCfg.productId ?? 0x0202, // TM-T20X II default
      );
      if (!hasPermission) {
        throw new Error('[ThermalPrinter] USB permission denied by user.');
      }
    }

    return this.mod.connect(config);
  }

  async disconnect(): Promise<void> {
    return this.mod.disconnect();
  }

  async isConnected(): Promise<boolean> {
    return this.mod.isConnected();
  }

  async getStatus(): Promise<ConnectionStatus> {
    return this.mod.getStatus();
  }

  // ── I/O ──────────────────────────────────────────────────────

  async write(data: number[]): Promise<PrintResult> {
    // Split into chunks to avoid exceeding the JS bridge message size limit.
    // Each chunk ≤ 512 bytes (USB bulk transfer size for TM-T20X).
    const CHUNK_SIZE = 512;
    let totalBytesWritten = 0;
    const jobId = `job_${Date.now()}`;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const result: PrintResult = await this.mod.write(chunk);
      totalBytesWritten += result.bytesWritten;
    }

    return {
      success: true,
      jobId,
      bytesWritten: totalBytesWritten,
      durationMs: 0, // set by caller
    };
  }

  // ── Discovery ────────────────────────────────────────────────

  async discoverDevices(
    type:    ConnectionType,
    timeout: number = 5000,
  ): Promise<DiscoveredDevice[]> {
    return this.mod.discoverDevices(type, timeout);
  }

  // ── USB ──────────────────────────────────────────────────────

  async requestUSBPermission(
    vendorId:  number,
    productId: number,
  ): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    return this.mod.requestUSBPermission(vendorId, productId);
  }

  // ── Cash drawer ─────────────────────────────────────────────

  async openCashDrawer(options: CashDrawerOptions): Promise<boolean> {
    return this.mod.openCashDrawer(options);
  }
}

// ─────────────────────────────────────────────────────────────
//  TurboModule spec (New Architecture codegen)
//  File: NativeRNThermalPrinter.ts
// ─────────────────────────────────────────────────────────────

export type Spec = {
  connect(config: Object): Promise<boolean>;
  disconnect(): Promise<void>;
  write(data: number[]): Promise<Object>;
  isConnected(): Promise<boolean>;
  discoverDevices(type: string, timeout: number): Promise<Object[]>;
  getStatus(): Promise<Object>;
  requestUSBPermission(vendorId: number, productId: number): Promise<boolean>;
  openCashDrawer(options: Object): Promise<boolean>;
};
