import { NativePrinter } from './native';
import type { DiscoveredDevice, ConnectionType } from '../types';

// ─────────────────────────────────────────────────────────────
//  PrinterDiscovery
//  High-level API to find available printers across all
//  supported connection types.
// ─────────────────────────────────────────────────────────────

export class PrinterDiscovery {
  private native: NativePrinter;

  constructor() {
    this.native = new NativePrinter();
  }

  /**
   * Scan all connection types simultaneously.
   * Returns combined list of discovered devices.
   */
  async discoverAll(timeoutMs = 8000): Promise<DiscoveredDevice[]> {
    const types: ConnectionType[] = ['usb', 'bluetooth', 'tcp'];
    const results = await Promise.allSettled(
      types.map(t => this.discover(t, timeoutMs)),
    );

    return results.flatMap(r =>
      r.status === 'fulfilled' ? r.value : [],
    );
  }

  /**
   * Scan a specific connection type.
   */
  async discover(
    type:      ConnectionType,
    timeoutMs: number = 5000,
  ): Promise<DiscoveredDevice[]> {
    return this.native.discoverDevices(type, timeoutMs);
  }

  /**
   * Shorthand: find all Epson printers via USB.
   * Filters by known Epson VendorId (0x04B8).
   */
  async discoverEpsonUSB(): Promise<DiscoveredDevice[]> {
    const all = await this.discover('usb');
    return all.filter(d => d.vendorId === 0x04b8);
  }

  /**
   * Scan network for TCP printers on port 9100.
   * Native side does an ARP + TCP-connect scan on the local subnet.
   */
  async discoverNetwork(timeoutMs = 10000): Promise<DiscoveredDevice[]> {
    return this.discover('tcp', timeoutMs);
  }

  /**
   * Scan Bluetooth Classic for paired SPP devices.
   */
  async discoverBluetooth(timeoutMs = 8000): Promise<DiscoveredDevice[]> {
    return this.discover('bluetooth', timeoutMs);
  }
}
