@echo off
set NDDS_QOS_PROFILES=file://%PULSE_DEMO_HOME%/pulse_sysdesigner/MedicalDemo.xml
set WIS_HTTP_PORT=8090
echo Listening on %WIS_HTTP_PORT%

CALL c:/PROGRA~1/rti_connext_dds-6.1.0/resource/scripts/rtisetenv_x64Win64VS2017.bat 
ECHO %NDDSHOME%

@echo ON
"%NDDSHOME%/bin/rtiwebintegrationservice.bat" ^
  -cfgName PulseWis ^
  -enableWebSockets ^
  -accessLogFile accessLogFile.txt ^
  -verbosity 6 ^
  -enableKeepAlive yes ^
  -listeningPorts %WIS_HTTP_PORT% ^
  -documentRoot examples
