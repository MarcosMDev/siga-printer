require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-thermal-printer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["repository"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "#{package["repository"]}.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"

  # New Architecture (Fabric/TurboModules)
  s.pod_target_xcconfig = {
    "SWIFT_VERSION"                           => "5.7",
    "DEFINES_MODULE"                          => "YES",
    "BUILD_LIBRARY_FOR_DISTRIBUTION"          => "YES",
    "OTHER_SWIFT_FLAGS"                       => "$(inherited) -D RCT_NEW_ARCH_ENABLED",
  }

  # Codegen spec for New Architecture
  install_modules_dependencies(s)
end
