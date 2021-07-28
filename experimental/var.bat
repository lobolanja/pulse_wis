@echo off
setlocal enableDelayedExpansion

set "options=-username:/ -option2:"" -option3:"three word default" -flag1: -flag2:"

for %%O in (%options%) do for /f "tokens=1,* delims=:" %%A in ("%%O") do set "%%A=%%~B"
:loop
if not "%~3"=="" (
  set "test=!options:*%~3:=! "
  if "!test!"=="!options! " (
      echo Error: Invalid option %~3
  ) else if "!test:~0,1!"==" " (
      set "%~3=1"
  ) else (
      setlocal disableDelayedExpansion
      set "val=%~4"
      call :escapeVal
      setlocal enableDelayedExpansion
      for /f delims^=^ eol^= %%A in ("!val!") do endlocal&endlocal&set "%~3=%%A" !
      shift /3
  )
  shift /3
  goto :loop
)
goto :endArgs
:escapeVal
set "val=%val:^=^^%"
set "val=%val:!=^!%"
exit /b
:endArgs

set -

:: To get the value of a single parameter, just remember to include the `-`
echo The value of -username is: !-username!

goto :eof

REM -----
@ECHO OFF

goto main

:usage
  ECHO %~0 will use SYS_DESIGNER, NDDS_QOS_PROFILES, WIS_HTTP_PORT and WIS_XML if defined
  goto :eof

:parse
    if /i "%~1"=="/?"         call :usage "%~2" 
    if /i "%~1"=="-?"         call :usage "%~2"
    if /i "%~1"=="--help"     call :usage "%~2" 

:main
SETLOCAL ENABLEEXTENSIONS
IF ERRORLEVEL 1 ECHO Unable to enable extensions, paths may be incorrect
IF NOT DEFINED NDDSHOME (^
          ECHO NDDSHOME must be defined)
IF NOT DEFINED SYS_DESIGNER (^
           SET SYS_DESIGNER=..\pulse_sysdesigner)
IF NOT DEFINED NDDS_QOS_PROFILES (^
           SET NDDS_QOS_PROFILES=file://%SYS_DESIGNER%\MedicalDemo.xml)
IF NOT DEFINED WIS_HTTP_PORT (^
           SET WIS_HTTP_PORT=8090)
IF NOT DEFINED WIS_XML (^
           SET WIS_XML=LOCAL_WEB_INTEGRATION_SERVICE.XML)
ECHO Listening on %WIS_HTTP_PORT%
@ECHO ON
"%NDDSHOME%/bin/rtiwebintegrationservice.bat" ^
  -cfgFile %WIS_XML% -cfgName PulseWis ^
  -enableKeepAlive yes ^
  -listeningPorts %WIS_HTTP_PORT% ^
  -documentRoot examples

ENDLOCAL
