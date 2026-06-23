package com.thermalprinter;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

import java.net.Socket;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Bluetooth
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

// Serial (USB-Serial adapter)
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;

@ReactModule(name = RNThermalPrinterModule.NAME)
public class RNThermalPrinterModule extends ReactContextBaseJavaModule {

    public static final String NAME = "RNThermalPrinter";
    private static final String ACTION_USB_PERMISSION = "com.thermalprinter.USB_PERMISSION";

    // ── State ──────────────────────────────────────────────────
    private final ReactApplicationContext reactContext;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // Connection state (one active connection at a time)
    private String       activeConnectionType = null;
    private boolean      isConnected          = false;

    // USB
    private UsbManager         usbManager;
    private UsbDeviceConnection usbConnection;
    private UsbEndpoint        usbEndpointOut;
    private int                usbTimeout = 3000;

    // Serial (USB-Serial)
    private UsbSerialPort serialPort;

    // Bluetooth
    private BluetoothSocket btSocket;
    private OutputStream    btOutputStream;

    // TCP
    private Socket       tcpSocket;
    private OutputStream tcpOutputStream;

    // Pending USB permission promise
    private Promise usbPermissionPromise;

    // ── Constructor ────────────────────────────────────────────

    public RNThermalPrinterModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        this.usbManager   = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    // ── USB Permission ─────────────────────────────────────────

    @ReactMethod
    public void requestUSBPermission(int vendorId, int productId, Promise promise) {
        UsbDevice device = findUSBDevice(vendorId, productId);
        if (device == null) {
            promise.reject("USB_NOT_FOUND",
                "No USB device found with vendorId=" + vendorId + " productId=" + productId);
            return;
        }

        if (usbManager.hasPermission(device)) {
            promise.resolve(true);
            return;
        }

        // Register receiver for the permission result
        this.usbPermissionPromise = promise;

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                    boolean granted = intent.getBooleanExtra(
                        UsbManager.EXTRA_PERMISSION_GRANTED, false);
                    context.unregisterReceiver(this);
                    if (usbPermissionPromise != null) {
                        usbPermissionPromise.resolve(granted);
                        usbPermissionPromise = null;
                    }
                }
            }
        };

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? PendingIntent.FLAG_MUTABLE
            : 0;
        PendingIntent pi = PendingIntent.getBroadcast(
            reactContext, 0, new Intent(ACTION_USB_PERMISSION), flags);

        reactContext.registerReceiver(receiver, filter);
        usbManager.requestPermission(device, pi);
    }

    // ── Connect ────────────────────────────────────────────────

    @ReactMethod
    public void connect(ReadableMap config, Promise promise) {
        String type = config.getString("type");
        executor.execute(() -> {
            try {
                switch (type) {
                    case "usb":       connectUSB(config);       break;
                    case "serial":    connectSerial(config);    break;
                    case "bluetooth": connectBluetooth(config); break;
                    case "tcp":       connectTCP(config);       break;
                    default:
                        promise.reject("UNKNOWN_TYPE", "Unknown connection type: " + type);
                        return;
                }
                activeConnectionType = type;
                isConnected = true;
                promise.resolve(true);
            } catch (Exception e) {
                isConnected = false;
                promise.reject("CONNECT_ERROR", e.getMessage(), e);
            }
        });
    }

    private void connectUSB(ReadableMap config) throws Exception {
        int vendorId  = config.hasKey("vendorId")  ? config.getInt("vendorId")  : 0x04b8;
        int productId = config.hasKey("productId") ? config.getInt("productId") : 0x0202;
        usbTimeout    = config.hasKey("timeout")   ? config.getInt("timeout")   : 3000;

        UsbDevice device = findUSBDevice(vendorId, productId);
        if (device == null) throw new Exception("USB device not found");
        if (!usbManager.hasPermission(device)) throw new Exception("USB permission not granted");

        UsbInterface usbInterface = device.getInterface(0);
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint ep = usbInterface.getEndpoint(i);
            // Bulk OUT endpoint (direction = OUT = 0)
            if (ep.getType() == 2 && ep.getDirection() == 0) {
                usbEndpointOut = ep;
            }
        }
        if (usbEndpointOut == null) throw new Exception("No bulk OUT endpoint found");

        usbConnection = usbManager.openDevice(device);
        if (usbConnection == null) throw new Exception("Failed to open USB device");
        usbConnection.claimInterface(usbInterface, true);
    }

    private void connectSerial(ReadableMap config) throws Exception {
        // Requires usb-serial-for-android library
        int baudRate = config.hasKey("baudRate") ? config.getInt("baudRate") : 115200;

        java.util.List<UsbSerialDriver> drivers =
            UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
        if (drivers.isEmpty()) throw new Exception("No serial devices found");

        UsbSerialDriver driver = drivers.get(0);
        UsbDeviceConnection connection = usbManager.openDevice(driver.getDevice());
        if (connection == null) throw new Exception("Failed to open serial device");

        serialPort = driver.getPorts().get(0);
        serialPort.open(connection);
        serialPort.setParameters(baudRate, 8,
            UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
    }

    private void connectBluetooth(ReadableMap config) throws Exception {
        String address = config.getString("address");
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new Exception("Bluetooth not available");
        if (!adapter.isEnabled()) throw new Exception("Bluetooth is disabled");

        BluetoothDevice device = adapter.getRemoteDevice(address);
        // Standard SerialPortProfile UUID
        UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
        btSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        adapter.cancelDiscovery();
        btSocket.connect();
        btOutputStream = btSocket.getOutputStream();
    }

    private void connectTCP(ReadableMap config) throws Exception {
        String host = config.getString("host");
        int port    = config.hasKey("port")    ? config.getInt("port")    : 9100;
        int timeout = config.hasKey("timeout") ? config.getInt("timeout") : 5000;

        tcpSocket = new Socket();
        tcpSocket.connect(new java.net.InetSocketAddress(host, port), timeout);
        tcpSocket.setSoTimeout(timeout);
        tcpOutputStream = tcpSocket.getOutputStream();
    }

    // ── Write ──────────────────────────────────────────────────

    @ReactMethod
    public void write(ReadableArray data, Promise promise) {
        if (!isConnected) {
            promise.reject("NOT_CONNECTED", "Printer not connected");
            return;
        }

        byte[] bytes = new byte[data.size()];
        for (int i = 0; i < data.size(); i++) {
            bytes[i] = (byte) data.getInt(i);
        }

        executor.execute(() -> {
            try {
                int written = writeBytes(bytes);
                WritableMap result = Arguments.createMap();
                result.putBoolean("success",      true);
                result.putString("jobId",         "job_" + System.currentTimeMillis());
                result.putInt("bytesWritten",     written);
                result.putInt("durationMs",       0);
                promise.resolve(result);
            } catch (Exception e) {
                promise.reject("WRITE_ERROR", e.getMessage(), e);
            }
        });
    }

    private int writeBytes(byte[] bytes) throws Exception {
        switch (activeConnectionType) {
            case "usb":
                return usbConnection.bulkTransfer(usbEndpointOut, bytes, bytes.length, usbTimeout);
            case "serial":
                serialPort.write(bytes, usbTimeout);
                return bytes.length;
            case "bluetooth":
                btOutputStream.write(bytes);
                btOutputStream.flush();
                return bytes.length;
            case "tcp":
                tcpOutputStream.write(bytes);
                tcpOutputStream.flush();
                return bytes.length;
            default:
                throw new Exception("Unknown connection type: " + activeConnectionType);
        }
    }

    // ── Disconnect ─────────────────────────────────────────────

    @ReactMethod
    public void disconnect(Promise promise) {
        executor.execute(() -> {
            try {
                if (usbConnection != null)    { usbConnection.close();    usbConnection = null; }
                if (serialPort != null)       { serialPort.close();       serialPort = null;    }
                if (btSocket != null)         { btSocket.close();         btSocket = null;      }
                if (tcpSocket != null)        { tcpSocket.close();        tcpSocket = null;     }
                btOutputStream  = null;
                tcpOutputStream = null;
                isConnected = false;
                activeConnectionType = null;
                promise.resolve(null);
            } catch (Exception e) {
                promise.reject("DISCONNECT_ERROR", e.getMessage(), e);
            }
        });
    }

    // ── Status ─────────────────────────────────────────────────

    @ReactMethod
    public void isConnected(Promise promise) {
        promise.resolve(isConnected);
    }

    @ReactMethod
    public void getStatus(Promise promise) {
        WritableMap status = Arguments.createMap();
        status.putBoolean("connected", isConnected);
        status.putString("type", activeConnectionType != null ? activeConnectionType : "none");
        promise.resolve(status);
    }

    // ── Discovery ──────────────────────────────────────────────

    @ReactMethod
    public void discoverDevices(String type, int timeout, Promise promise) {
        executor.execute(() -> {
            com.facebook.react.bridge.WritableArray devices =
                Arguments.createArray();
            try {
                switch (type) {
                    case "usb":
                        HashMap<String, UsbDevice> usbDevices = usbManager.getDeviceList();
                        for (UsbDevice d : usbDevices.values()) {
                            WritableMap dev = Arguments.createMap();
                            dev.putString("type",      "usb");
                            dev.putString("name",      d.getDeviceName());
                            dev.putString("address",   d.getDeviceName());
                            dev.putInt("vendorId",     d.getVendorId());
                            dev.putInt("productId",    d.getProductId());
                            devices.pushMap(dev);
                        }
                        break;
                    case "bluetooth":
                        BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
                        if (btAdapter != null && btAdapter.isEnabled()) {
                            for (BluetoothDevice d : btAdapter.getBondedDevices()) {
                                WritableMap dev = Arguments.createMap();
                                dev.putString("type",    "bluetooth");
                                dev.putString("name",    d.getName());
                                dev.putString("address", d.getAddress());
                                devices.pushMap(dev);
                            }
                        }
                        break;
                    // TCP discovery requires a native subnet scan — stub for now
                    case "tcp":
                        break;
                }
                promise.resolve(devices);
            } catch (Exception e) {
                promise.reject("DISCOVERY_ERROR", e.getMessage(), e);
            }
        });
    }

    // ── Cash drawer ────────────────────────────────────────────

    @ReactMethod
    public void openCashDrawer(ReadableMap options, Promise promise) {
        int pin      = options.hasKey("pin")      ? options.getInt("pin")      : 2;
        int duration = options.hasKey("duration") ? options.getInt("duration") : 100;

        // ESC p m t1 t2
        byte m  = pin == 5 ? (byte) 0x01 : (byte) 0x00;
        byte t1 = (byte) Math.min(duration / 2, 0xff);
        byte[] cmd = { 0x1b, 0x70, m, t1, 0x19 };

        executor.execute(() -> {
            try {
                writeBytes(cmd);
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("DRAWER_ERROR", e.getMessage(), e);
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────────

    @Nullable
    private UsbDevice findUSBDevice(int vendorId, int productId) {
        for (UsbDevice d : usbManager.getDeviceList().values()) {
            if (d.getVendorId() == vendorId && d.getProductId() == productId) {
                return d;
            }
        }
        return null;
    }
}
