#import <React/RCTBridgeModule.h>

// ─────────────────────────────────────────────────────────────
//  RNThermalPrinter — Objective-C bridge for Swift module
//  Exposes the Swift class to React Native's bridge
// ─────────────────────────────────────────────────────────────

@interface RCT_EXTERN_MODULE(RNThermalPrinter, NSObject)

RCT_EXTERN_METHOD(
  connect:(NSDictionary *)config
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  write:(NSArray *)data
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  disconnect:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  isConnected:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  getStatus:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  discoverDevices:(NSString *)type
  timeout:(double)timeout
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  requestUSBPermission:(double)vendorId
  productId:(double)productId
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  openCashDrawer:(NSDictionary *)options
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
