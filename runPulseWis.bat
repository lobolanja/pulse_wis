@echo off
set NDDS_QOS_PROFILES=file://%PULSE_DEMO_HOME%/pulse_sysdesigner/MedicalDemo.xml
set WIS_HTTP_PORT=8090
echo Listening on %WIS_HTTP_PORT%
"%NDDSHOME%/bin/rtiwebintegrationservice.bat" ^
  -cfgName PulseWis ^
  -enableKeepAlive yes ^
  -listeningPorts %WIS_HTTP_PORT% ^
  -documentRoot examples
