/*
 * (c) 2016-2021 Copyright, Real-Time Innovations, Inc.  All rights reserved.
 * RTI grants Licensee a license to use, modify, compile, and create derivative
 * works of the Software.  Licensee has the right to distribute object form
 * only for use with RTI products.  The Software is provided "as is", with no
 * warranty of any type, including any warranty for fitness for any purpose.
 * RTI is under no obligation to maintain or support the Software.  RTI shall
 * not be liable for any incidental or consequential damages arising out of the
 * use or inability to use the software.
 */

var rti = rti || {};
/**
 * @namespace rti.pulse
 */
rti.pulseapp = {
    PULSE_DATA_WS_NAME: "MyWebSocketConnection",
    BIND_PULSE_READER_ID: "BindPulseReaderId",
    X_POINT_COUNT: 1000,
    BROWSER_UPDATE_RATE_MS: 65,   
    patientId: "na",
    patientConfig: {
        high: 90, 
        low: 50,
    },
    ws_pulse: null,
    COUNT_ITEM: null,
    HEARTBEAT_VALUE: null,
    chartConfig: {},
    counts: {
        updateCount: 0, emptyCount: 0,
        sampleCount: 0, totalSampleCount: 0,
    },
    alarm: false,
    lineChart: null,
    prevSampleTimestamp: -1, /* keep track of previous sample ts to filter out dups now that we read() vs. take() */

    bumpEmptyCount:  function() { this.counts.emptyCount++;  return this.counts.emptyCount; },
    bumpUpdateCount: function() { this.counts.updateCount++; return this.counts.updateCount; },
    getUpdateCount:  function() { return this.counts.updateCount; },
    getSampleCount:  function() { return this.counts.sampleCount; },
    getTotalSampleCount: function() { return this.counts.totalSampleCount; },
    setSampleCount: function(n) { this.counts.sampleCount = n; this.counts.totalSampleCount += n; return this.counts.sampleCount; },

        // provide a nominal value (500) to the chart for the number of points provided
    fillChartLine: function(points, shift) {
        // console.log(points);
        for (var i=0; i< points; i++){
          // prefill the chart withnominal data (autoscales)
          if (shift) {
            rti.pulseapp.chartConfig.data.datasets[0].data.shift();
            rti.pulseapp.chartConfig.data.labels.shift();
          }
          rti.pulseapp.chartConfig.data.labels.push('0:00');
          rti.pulseapp.chartConfig.data.datasets[0].data.push(500);
        }
    },

    getBaseURL: function(is_pub) {
      var app = "/dds/rest1/applications/PulseWisApp";
      var pant = "domain_participants/PulseWisParticipant";
      var pOrS;
      if (is_pub) {
        pOrS = "publishers/PulseWisPublisher/data_writers";
      } else {
        pOrS = "subscribers/PulseWisSubscriber/data_readers";
      }
      return `${app}/${pant}/${pOrS}`;
    },
    getPulseReaderURL: function() {
        return this.getBaseURL(false) + "/PatientPulseReader";
    },
    getPatientConfigReaderURL: function() {
    return this.getBaseURL(false) + "/PatientConfigReader";
    },
    getPatientInfoReaderURL: function() {
    return this.getBaseURL(false) + "/PatientInfoReader";
    },
    getPatientConfigWriterURL: function() {
    return this.getBaseURL(true) + "/PatientConfigWriter";
    },
    getWebSocketURL: function() {
      return "/dds/v1/websocket_connections";
    },
    /**
     * Sets up a new chart. This method needs to be called before reading or drawing ecg info.
     */
    setupScenario: function() {
        this.chartConfig = {
            type: 'line',
            scale: { xScalePaddingLeft: 0, xScalePaddingRight: 0},
            data: {
                labels: [],
                //defaultFontSize: 20,
                datasets: [{
                    label: "Pulse",
                    backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: [],
                    fill: false,
                    pointRadius:1, // removes the dots, default: 3
                }, {
                    label: "bar",
                    backgroundColor: 'rgba(200,200,200,1)',
                    borderColor: 'rgba(200,200,200,1)',
                    data: [],
                    fill: true,
                    pointRadius:1, // removes the dots, default: 3
                }],
            },
            options: {
                animation: {duration: 0 }, // speeds up display
                events: [], // disable hover and tooltip behavior
                title: {
                    display: false,
                    text: 'Pulse Graph',
                },
                legend: {
                    display: false
                },
                layout: {
                    padding: {
                        left: -2, right: 10, top: 20, bottom: 30
                    },
                },
                scales: {
                    xAxes: [{
                        display: true,
                        gridLines: { display: false},
                        ticks: { display: false},
                        scaleLabel: {
                            display: true,
                            labelString: '',
                        }
                    }],
                    yAxes: [{
                        display: true,
                        //ticks: { min:0, max:1050, stepSize:50, display:false},
                        scaleLabel: {
                            display: false,
                            labelString: 'Value'
                        }
                    }]
                }
            }
        };

        context = document.getElementById('canvas').getContext('2d');
        this.lineChart = new Chart(context, this.chartConfig);

        this.fillChartLine(this.X_POINT_COUNT, false);
        //this.lineChart.update();

        /* Button handlers  */
        document.getElementById("btnHighUpId").addEventListener(
            "click", 
            function() { 
                rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high+10, rti.pulseapp.patientConfig.low);
            }, 
            false
        );
        document.getElementById("btnHighDownId").addEventListener(
            "click", 
            function() { 
                rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high-10, rti.pulseapp.patientConfig.low);
            }, 
            false
        );
        document.getElementById("btnLowUpId").addEventListener(
            "click", 
            function() { 
                rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high, rti.pulseapp.patientConfig.low+10);
                }, 
            false
         );
        document.getElementById("btnLowDownId").addEventListener(
            "click", 
            function() { 
                rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high, rti.pulseapp.patientConfig.low-10);
            }, 
            false
        );
        rti.pulseapp.initWebSocketREST();
        rti.pulseapp.initWebSocket();
        rti.pulseapp.initPatientInfo();
        rti.pulseapp.initPatientConfig();  
    },
    bind:function() {
        var pr_url = rti.pulseapp.getPulseReaderURL();
        var bind_data_json = {
            "kind": "bind",
            "body": [ {
                "bind_kind":"bind_datareader",
                "bind_id": rti.pulseapp.BIND_PULSE_READER_ID,
                "uri": pr_url
            } ]
        };
        rti.pulseapp.ws_pulse.send(JSON.stringify(bind_data_json));

        var get_req_msg_json = {
            "kind": "request",
            "id": rti.pulseapp.BIND_PULSE_READER_ID,
            "method": "GET",
            "uri": pr_url
        };
        rti.pulseapp.ws_pulse.send(JSON.stringify(get_req_msg_json));
    },
    initWebSocket:function() {
        var url = "ws://" + window.location.host + "/dds/websocket/" + rti.pulseapp.PULSE_DATA_WS_NAME;
        console.log("ws_pulse: " +  url);
        rti.pulseapp.ws_pulse = new WebSocket(url, ['omg-dds', 'dds-web', 'foo']);
    
        rti.pulseapp.ws_pulse.onopen = function(ev) {
            console.log("[open] Conn established");
            rti.pulseapp.ws_pulse.send(  // hello message
                "Content-Type:application/dds-web+json\r\n" +
                "Accept:application/dds-web+json\r\n" +
                "OMG-DDS-API-Key: \r\n" +
                "Version:1\r\n");
            rti.pulseapp.bind();
        };

        rti.pulseapp.ws_pulse.onclose = function(ev) {
            if (ev.wasClean) {
                console.log(`[close] Connection closed cleanly, code=${ev.code} reason=${ev.reason}`);
            } else {
                // e.g. server process killed or network down
                // event.code is usually 1006 in this case
                console.log(`[close] Connection died code=${ev.code}`);
            }
        };

        rti.pulseapp.ws_pulse.onerror = function(error) {
            console.log(`[error] ${error.message}`);
        };

        rti.pulseapp.ws_pulse.onmessage = function(msg) {
            if (!msg.data) {
               console.log("No data in msg");
            } else if (msg.data.includes("HELLO")) {
              console.log(msg.data);
            } else { // pushed data arrives here after websocket handshake is completed
                var parsed = JSON.parse(msg.data);
                //console.log(parsed);
		console.log("bufAmt: " + rti.pulseapp.ws_pulse.bufferedAmount);
                if (parsed.bind_id && parsed.bind_id == rti.pulseapp.BIND_PULSE_READER_ID) { 
                    // PROCESS the SAMPLE
                    rti.pulseapp.updateChart(parsed);
                } else {
                    console.log("No bind_id");
                }
            }
        };
    },
    initWebSocketREST: function() {
        let wsURL = this.getWebSocketURL();
        let configDataJSON = JSON.stringify(
            [{ "name": rti.pulseapp.PULSE_DATA_WS_NAME}]
        );

        $.ajax({
          type:"POST",
          url:wsURL,
          data: configDataJSON,
          contentType:"application/dds-web+json",
          dataType:"json",
          success: function(param){
             console.log("sent OK " + configDataJSON);
          },
          failure: function(param){
              console.log("No WebSocket enable. Error: " + param.responseText);
          }
        });
    },
    initPatientInfo:function() {
        rti.pulseapp.COUNT_ITEM = document.getElementById("countId");
        rti.pulseapp.HEARTBEAT_VALUE = document.getElementById("heartbeatValue");
        let url = this.getPatientInfoReaderURL();
        $.getJSON(
            url,
            { sampleFormat:"json", removeFromReaderCache: "false"}, 
            function(info) {
                if (info && info.length) {
                    rti.pulseapp.updatePatientInfo(info[0]);
                }
            }
        );
    },

    initPatientConfig:function() {
    // first browser to connect will publish the default value
        let url = this.getPatientConfigReaderURL();
        
        $.getJSON(
            url,
            { sampleFormat:"json", removeFromReaderCache: "false"}, 
            function(samples) {
                let data;
                if (samples && samples.length) {
                    data = samples[0].data;
                } else {
                    rti.pulseapp.writePatientConfig(
                            rti.pulseapp.patientConfig.high,
                            rti.pulseapp.patientConfig.low
                    );
                    data = {
                        "PulseHighThreshold": rti.pulseapp.patientConfig.high,
                        "PulseLowThreshold":  rti.pulseapp.patientConfig.low,
                    };
                }
                rti.pulseapp.updatePatientConfig(data.PulseHighThreshold, data.PulseLowThreshold);
            }
        );
        
    }, 
    
    updatePatientInfo(sample) {
        //console.log(sample.data.Id.Id);
        let name = `${sample.data.FirstName} ${sample.data.LastName}     Age: ${sample.data.Age}  ID: ${sample.data.Id.Id}`;
        this.chartConfig.options.scales.xAxes[0].scaleLabel.labelString = name;
            //console.log('updatePatientInfo: ' + sample.data.Id);
        this.patientId = sample.data.Id.Id;
    },
    /**
     *  The run method will only update button activity; pulse data is pushed via websocket
     */
    run: function() {

        var configURL = this.getPatientConfigReaderURL();
        setInterval(function(){   // runs once per second
                  // Alarm flash
            if (rti.pulseapp.alarm) {
                $('#heartbeatValue').css("color", "red");
                $("#heartbeatValue").fadeOut(450).fadeIn(450);
            } else {
                $("#heartbeatValue").fadeIn(450);    // ensure it's faded back in!
                $('#heartbeatValue').css("color", "orange");
                $("#heartbeatValue").stop(true, true).finish();
            }

            // Also update the PatientConfig value
            $.getJSON(
                configURL,
                { sampleFormat:"json", removeFromReaderCache: "false" },
                function(samples) {
                    //console.log('config: ', samples);
                    if (samples && samples.length) {
                        let data = samples[0].data;
                        rti.pulseapp.updatePatientConfig(data.PulseHighThreshold, data.PulseLowThreshold);
                    }
                }
            );

        }, 1000);
    },

    updateChart: function(sampleSeq) {

        var chartData = this.chartConfig.data.datasets[0].data;

        //console.log ("sampleSeq len: ", sampleSeq.body.read_sample_seq.length);
        let readSampleSeq = sampleSeq.body.read_sample_seq;
        readSampleSeq.forEach(function(sample/*, ix, readSampleSeq*/) {
            // Process metadata
            if (!sample.data || !sample.data.readings || !sample.data.readings.length)  {
                console.log("Bad sample: " + sample);
                return;
            }
            rti.pulseapp.setSampleCount(sample.data.readings.length);

            if (!sample.read_sample_info.valid_data) {
                console.log("Skipping invalid data");
                return;
            }
            if (sample.read_sample_info.instance_state !== "ALIVE") { 
                console.log("Skipping non-alive data");
                return;
            }

            sample.data.readings.forEach(function(reading, index, readings){
                rti.pulseapp.chartConfig.data.labels.shift();
                chartData.shift();

                // uncomment if using time labels
                // let dt = new Date (sample.read_sample_info.source_timestamp.sec * 1000);
                // this.chartConfig.data.labels(('00'+dt.getMinutes()).slice(-2) + ':' + 
                                 // ('00'+dt.getSeconds()).slice(-2));
            rti.pulseapp.chartConfig.data.labels.push("");
                chartData.push(reading);
            });
            document.getElementById("heartbeatValue").innerHTML = sample.data.bpm;
	    rti.pulseapp.HEARTBEAT_VALUE.innerHTML = sample.data.bpm;
            rti.pulseapp.alarm = (
                (sample.data.bpm >= rti.pulseapp.patientConfig.high) || 
                (sample.data.bpm <= rti.pulseapp.patientConfig.low)
            );
            rti.pulseapp.COUNT_ITEM.innerHTML = "update count: " + rti.pulseapp.bumpUpdateCount();
                //+ " sample count: " + rti.pulseapp.getSampleCount() +
                //    " total samples: " + rti.pulseapp.getTotalSampleCount();
        });
        this.lineChart.update();
    },
    
    updatePatientConfig: function(high, low) {
        rti.pulseapp.patientConfig.high = high;
        rti.pulseapp.patientConfig.low = low;
        $("#highValueId").prop("innerHTML", high);
        $("#lowValueId").prop("innerHTML", low);

        if (high >= 200) {
          $('#btnHighUpId').addClass('disabled');
        } else {
          $('#btnHighUpId').removeClass('disabled');
        }

        $('#btnHighUpId').prop("disabled", high >= 200);
        $('#btnHighDownId').prop("disabled", high <= rti.pulseapp.patientConfig.low+10);
        $('#btnLowUpId').prop("disabled", low >= rti.pulseapp.patientConfig.high-10);
        //$('#btnLowDownId').prop("disabled", low <= 10);
        document.getElementById('btnLowDownId').disabled = (low <= 0);
        //let x = document.getElementById('btnLowDownId').disabled;
        //console.log({disabled: x});
    },
        /* Write some value back on the PatientConfig topic */
    writePatientConfig: function(highValue, lowValue) {
        const configURL = this.getPatientConfigWriterURL();
        var configData = { 
            Id: {Id: this.patientId.toString()}, 
            PulseHighThreshold: highValue,
            PulseLowThreshold: lowValue,
        };

        var configDataJSON = JSON.stringify(configData);
        // console.log(configDataJSON);

        $.ajax({
          url:configURL,
          type:"POST",
          data:configDataJSON,
          contentType:"application/dds-web+json",
          dataType:"json",
          success: function(param){
          // console.log("sent " + configDataJSON);
          }
        });
    }, 
}

