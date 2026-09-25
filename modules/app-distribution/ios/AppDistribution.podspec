Pod::Spec.new do |s|
  s.name           = 'AppDistribution'
  s.version        = '1.0.0'
  s.summary        = 'Tells a TestFlight install from an App Store one'
  s.license        = 'MIT'
  s.author         = 'Threadbase'
  s.homepage       = 'https://github.com/RonenMars/threadbase-mobile'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
