#!/bin/bash
if [ 2 -eq `ps auxw|grep 'rtiwebintegrationservice.*8090'|wc -l` ];
then
     echo "It looks like WIS is already running, try killing it first"
     echo "     kill `ps axw|grep 'rtiwebintegrationservice.*8090'|awk '{$1=$1}1'|cut -d ' ' -f 1|head -n 1`"
     exit
fi
echo "Starting WIS"
export NDDS_QOS_PROFILES=file://$PULSE_DEMO_HOME/pulse_sysdesigner/MedicalDemo.xml
$NDDSHOME/bin/rtiwebintegrationservice -cfgName PulseWis -enableKeepAlive yes -listeningPorts 8090 -documentRoot examples &

