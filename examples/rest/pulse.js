/*
 * (c) 2016-2020 Copyright, Real-Time Innovations, Inc.  All rights reserved.
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
    X_POINT_COUNT: 1000,
    BROWSER_UPDATE_RATE_MS: 65,   
    patientId: "na",
    patientConfig: {
        high: 90, 
        low: 50,
    },
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
        pOrS = "publishers/PulseWisPublisher";
      } else {
        pOrS = "subscribers/PulseWisSubscriber";
      }
      return `${app}/${pant}/${pOrS}`;
    },
    getPulseReaderURL: function() {
        return this.getBaseURL(false) + "/data_readers/PatientPulseReader";
    },
    getPatientConfigReaderURL: function() {
    return this.getBaseURL(false) + "/data_readers/PatientConfigReader";
    },
    getPatientInfoReaderURL: function() {
    return this.getBaseURL(false) + "/data_readers/PatientInfoReader";
    },
    getPatientConfigWriterURL: function() {
    return this.getBaseURL(true) + "/data_writers/PatientConfigWriter";
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
                            labelString: '', //'Some Patient',
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
        rti.pulseapp.initPatientInfo();
        rti.pulseapp.initPatientConfig();  
    },

    initPatientInfo:function() {
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
                    rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high, rti.pulseapp.patientConfig.low);
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
     *  The method will call the methods that update the display at 33 ms intervals.
     */
    run: function() {
        var url = this.getPulseReaderURL();

        var configURL = this.getPatientConfigReaderURL();

        // Call chartjs() for ecgPulse and bpm every ecgReadIntervalPeriod, passing the data resulting
        // for reading new samples of the appropriate topic in json format without deleting the samples
        // from the Reader's cache.
        setInterval(function(){
            // Read pulse
            $.getJSON(
                url,
                { sampleFormat: "json", removeFromReaderCache: "false" },
                function(data) {
                    if (data) {
                        rti.pulseapp.updateChart(data); 
                    } else {
                        console.log('got empty data' + this.bumpEmptyCnt());
                    }
                }
            );

        }, rti.pulseapp.BROWSER_UPDATE_RATE_MS);

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
  
    /**
     * Updates the chart with the sequence of values
     * @param sampleSeq Sequence of samples to be drawn.
     */

    updateChart: function(sampleSeq) {
        var chartData = this.chartConfig.data.datasets[0].data;
        var chartLabels = this.chartConfig.data.labels;
        var lineChart = this.lineChart;
        
        // how to change the line color in time (can also be changed by value condition)
        // lineChart.config.data.datasets[0].borderColor="rgb(255, 99, 132)";
        // lineChart.config.data.datasets[0].backgroundColor="rgb(255, 99, 132)";
    
        // console.log ("Sample seq len: ", sampleSeq.length)
        if (sampleSeq.length !=0) {
            rti.pulseapp.fillChartLine(rti.pulseapp.X_POINT_COUNT- (sampleSeq.length * sampleSeq[0].data.readings.length), true);
        }

        sampleSeq.forEach(function(sample, i, samples) {
            // Process metadata
            
            // console.log("sample", sample);
            // console.log(sample.data.readings.length);

            var info = sample.read_sample_info;
            var valid_data = info.valid_data;
            var instance_handle = info.instance_handle;
            var instance_state  = info.instance_state;
            var reception_time  = info.source_timestamp;
            var error_str = "no error";
            rti.pulseapp.setSampleCount(sample.data.readings.length);

            // log if we get a sample out of sequence - note between sample sequences since we often re-read 
            // the WIS reader cache = prev sample sequence number will be 99 or 100 less than the timestamp
            // number in the first sample of the sequence. - then it falls into line.
            if (sample.data.timestamp > rti.pulseapp.prevSampleTimestamp+1) {
                (i==0) ? error_str = "between sample sets" : error_str = "Inside sample set";
                console.log("Lost packet " + error_str + " @Seqence: " + i + 
                " Timestamps: " + sample.data.timestamp + " " + rti.pulseapp.prevSampleTimestamp);
            }

            // If we received an invalid data sample, and the instance state
            // is != ALIVE, then the instance has been either disposed or
            // unregistered and we ignore the sample.
            if (valid_data && (instance_state === "ALIVE")) {  //&& 
                //(sample.data.timestamp > rti.pulseapp.prevSampleTimestamp)) {
                    rti.pulseapp.prevSampleTimestamp = sample.data.timestamp;
                    // console.log(sample.data.timestamp);
                    // console.log(chartData.length);
                    // console.log(sample.data.readings.length);
                    // console.log(sample.data.readings);

                    sample.data.readings.forEach(function(reading, index){
                        //index += index;
                        // if (reading < 100) { return; } //- return from this sample - simple filter to get rid of spikes in the data
                        // Better to fix this at the source (not the browser) or integrate the sample more.

                        chartLabels.shift();
                        chartData.shift();

                        //console.log(reception_time.sec);
                        let dt = new Date (reception_time.sec * 1000);
                        chartLabels.push(('00'+dt.getMinutes()).slice(-2) + ':' + 
                                        ('00'+dt.getSeconds()).slice(-2));
                        chartData.push(reading);
                    });
                    //lineChart.update();
                    var value = sample.data.bpm;
                    var elementHb = document.getElementById("heartbeatValue");
                    elementHb.innerHTML = value;
                    // local alarm of bmp (not DDS as one - alarms should come from central control)
                    //console.log(value, rti.pulseapp.patientConfig.high);
                    if (!rti.pulseapp.alarm && ((value >= rti.pulseapp.patientConfig.high) || (value <= rti.pulseapp.patientConfig.low))) {
                        rti.pulseapp.alarm=true;
                    } else if (rti.pulseapp.alarm && ((value < rti.pulseapp.patientConfig.high) && (value >rti.pulseapp.patientConfig.low))) {
                        rti.pulseapp.alarm=false;
                    }

            } else {  // we re-read prior sequential set of data from cache - we don't need to re-display (only a waste of time)
                // console.log("Dropping,Read old data: prev ts " + rti.pulseapp.prevSampleTimestamp + "data ts " + sample.data.timestamp + " rec: " + info.source_timestamp.sec);
            }
            const COUNT_ITEM = document.getElementById("countId");
            COUNT_ITEM.innerHTML = "update count: " + rti.pulseapp.bumpUpdateCount();
                //+ " sample count: " + rti.pulseapp.getSampleCount() +
                //    " total samples: " + rti.pulseapp.getTotalSampleCount();
        });
        lineChart.update();
        //}
    },
    /* update the screen's config */
    updatePatientConfig: function(high, low) {
        //console.log({updatePatientConfig:{high: high, low: low}});
        // console.log (high, low);
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
