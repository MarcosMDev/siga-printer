require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "siga-printer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { package["author"]["name"] => package["author"]["url"] }

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/MarcosMDev/siga-printer.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"

  s.pod_target_xcconfig = {
    "SWIFT_VERSION"                  => "5.7",
    "DEFINES_MODULE"                 => "YES",
    "BUILD_LIBRARY_FOR_DISTRIBUTION" => "YES",
    "OTHER_SWIFT_FLAGS"              => "$(inherited) -D RCT_NEW_ARCH_ENABLED",
  }

  install_modules_dependencies(s)
end
