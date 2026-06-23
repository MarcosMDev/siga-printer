import Foundation
import UIKit
import ExternalAccessory  // For MFi Bluetooth printers
import React

// ─────────────────────────────────────────────────────────────
//  SigaPrinter — iOS Swift native module
//
//  Supports:
//    - TCP/IP (most common on iOS — direct socket)
//    - Bluetooth (MFi accessories via ExternalAccessory)
//
//  NOTE: USB OTG is not available on iOS (hardware limitation).
//  Serial is available only via MFi accessory protocol.
// ─────────────────────────────────────────────────────────────

@objc(SigaPrinter)
class SigaPrinter: NSObject {

    // ── State ────────────────────────────────────────────────

    private var connectionType: String?
    private var connected = false

    // TCP
    private var tcpInputStream:  InputStream?
    private var tcpOutputStream: OutputStream?

    // MFi Bluetooth
    private var eaSession:    EASession?
    private var eaAccessory:  EAAccessory?
    private let MFI_PROTOCOL = "com.epson.escpos"

    // ── Connect ──────────────────────────────────────────────

    @objc func connect(_ config: NSDictionary, resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        guard let type = config["type"] as? String else {
            reject("INVALID_CONFIG", "Missing connection type", nil); return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                switch type {
                case "tcp":       try self.connectTCP(config)
                case "bluetooth": try self.connectBluetooth(config)
                case "serial":
                    // Serial via MFi on iOS
                    try self.connectBluetooth(config)
                case "usb":
                    throw NSError(domain: "ThermalPrinter",
                        code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "USB not supported on iOS"])
                default:
                    throw NSError(domain: "ThermalPrinter",
                        code: 2,
                        userInfo: [NSLocalizedDescriptionKey: "Unknown type: \(type)"])
                }
                self.connectionType = type
                self.connected = true
                resolve(true)
            } catch {
                self.connected = false
                reject("CONNECT_ERROR", error.localizedDescription, error)
            }
        }
    }

    private func connectTCP(_ config: NSDictionary) throws {
        guard let host = config["host"] as? String else {
            throw NSError(domain: "ThermalPrinter", code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Missing host"])
        }
        let port    = config["port"]    as? UInt32 ?? 9100
        let timeout = config["timeout"] as? TimeInterval ?? 5.0

        var readStream:  Unmanaged<CFReadStream>?
        var writeStream: Unmanaged<CFWriteStream>?

        CFStreamCreatePairWithSocketToHost(
            nil,
            host as CFString,
            port,
            &readStream,
            &writeStream
        )

        guard
            let iStream = readStream?.takeRetainedValue(),
            let oStream = writeStream?.takeRetainedValue()
        else {
            throw NSError(domain: "ThermalPrinter", code: 4,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create TCP streams"])
        }

        tcpInputStream  = iStream as InputStream
        tcpOutputStream = oStream as OutputStream

        tcpInputStream?.open()
        tcpOutputStream?.open()

        // Verify connection
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if tcpOutputStream?.streamStatus == .open { return }
            Thread.sleep(forTimeInterval: 0.1)
        }

        throw NSError(domain: "ThermalPrinter", code: 5,
            userInfo: [NSLocalizedDescriptionKey: "TCP connection timed out to \(host):\(port)"])
    }

    private func connectBluetooth(_ config: NSDictionary) throws {
        let accessories = EAAccessoryManager.shared().connectedAccessories
        let target = accessories.first { accessory in
            if let name = config["name"] as? String {
                return accessory.name == name
            }
            return accessory.protocolStrings.contains(MFI_PROTOCOL)
        }

        guard let accessory = target else {
            throw NSError(domain: "ThermalPrinter", code: 6,
                userInfo: [NSLocalizedDescriptionKey: "No MFi accessory found. " +
                    "Ensure the printer is paired and listed in Settings > Bluetooth."])
        }

        eaAccessory = accessory
        eaSession   = EASession(accessory: accessory, forProtocol: MFI_PROTOCOL)

        guard let session = eaSession else {
            throw NSError(domain: "ThermalPrinter", code: 7,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create EASession"])
        }

        session.outputStream?.open()
    }

    // ── Write ────────────────────────────────────────────────

    @objc func write(_ data: [NSNumber],
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject:  @escaping RCTPromiseRejectBlock) {
        guard connected else {
            reject("NOT_CONNECTED", "Printer not connected", nil); return
        }

        let bytes = data.map { UInt8(truncating: $0) }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let written = try self.writeBytes(bytes)
                resolve([
                    "success":      true,
                    "jobId":        "job_\(Int(Date().timeIntervalSince1970 * 1000))",
                    "bytesWritten": written,
                    "durationMs":   0,
                ])
            } catch {
                reject("WRITE_ERROR", error.localizedDescription, error)
            }
        }
    }

    private func writeBytes(_ bytes: [UInt8]) throws -> Int {
        let data = Data(bytes)

        switch connectionType {
        case "tcp":
            guard let stream = tcpOutputStream else {
                throw NSError(domain: "ThermalPrinter", code: 8,
                    userInfo: [NSLocalizedDescriptionKey: "TCP output stream nil"])
            }
            return data.withUnsafeBytes { ptr in
                stream.write(ptr.bindMemory(to: UInt8.self).baseAddress!, maxLength: data.count)
            }

        case "bluetooth", "serial":
            guard let stream = eaSession?.outputStream else {
                throw NSError(domain: "ThermalPrinter", code: 9,
                    userInfo: [NSLocalizedDescriptionKey: "BT output stream nil"])
            }
            return data.withUnsafeBytes { ptr in
                stream.write(ptr.bindMemory(to: UInt8.self).baseAddress!, maxLength: data.count)
            }

        default:
            throw NSError(domain: "ThermalPrinter", code: 10,
                userInfo: [NSLocalizedDescriptionKey: "Unknown connection type"])
        }
    }

    // ── Disconnect ───────────────────────────────────────────

    @objc func disconnect(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject:    @escaping RCTPromiseRejectBlock) {
        tcpInputStream?.close()
        tcpOutputStream?.close()
        eaSession?.outputStream?.close()
        eaSession    = nil
        eaAccessory  = nil
        connected    = false
        connectionType = nil
        resolve(nil)
    }

    // ── Status ───────────────────────────────────────────────

    @objc func isConnected(_ resolve: RCTPromiseResolveBlock,
                           reject:    RCTPromiseRejectBlock) {
        resolve(connected)
    }

    @objc func getStatus(_ resolve: RCTPromiseResolveBlock,
                         reject:    RCTPromiseRejectBlock) {
        resolve([
            "connected": connected,
            "type":      connectionType ?? "none",
        ])
    }

    // ── Discovery ────────────────────────────────────────────

    @objc func discoverDevices(_ type: String, timeout: Double,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject:  @escaping RCTPromiseRejectBlock) {
        var devices: [[String: Any]] = []

        if type == "bluetooth" {
            let accessories = EAAccessoryManager.shared().connectedAccessories
            devices = accessories.map { acc in [
                "type":    "bluetooth",
                "name":    acc.name,
                "address": acc.serialNumber,
            ]}
        }

        resolve(devices)
    }

    // ── USB permission (no-op on iOS) ─────────────────────────

    @objc func requestUSBPermission(_ vendorId: Double, productId: Double,
                                    resolve: RCTPromiseResolveBlock,
                                    reject:  RCTPromiseRejectBlock) {
        resolve(false) // USB not supported on iOS
    }

    // ── Cash drawer ──────────────────────────────────────────

    @objc func openCashDrawer(_ options: NSDictionary,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject:  @escaping RCTPromiseRejectBlock) {
        let pin      = options["pin"]      as? Int ?? 2
        let duration = options["duration"] as? Int ?? 100
        let m:  UInt8 = pin == 5 ? 0x01 : 0x00
        let t1: UInt8 = UInt8(min(duration / 2, 0xff))
        let cmd: [UInt8] = [0x1b, 0x70, m, t1, 0x19]

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                _ = try self.writeBytes(cmd)
                resolve(true)
            } catch {
                reject("DRAWER_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ── Module export ────────────────────────────────────────

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
