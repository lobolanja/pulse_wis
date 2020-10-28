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
    patientId: null,
    patientConfig: {
      high: 200, 
      low: 50,
    },
    chartConfig: {},
    counts: {
      updateCount: 0, emptyCount: 0,
      sampleCount: 0, totalSampleCount: 0,
    },
    lineChart: null,
    bumpEmptyCount:  function() { this.counts.emptyCount++;  return this.counts.emptyCount; },
    bumpUpdateCount: function() { this.counts.updateCount++; return this.counts.updateCount; },
    getUpdateCount:  function() { return this.counts.updateCount; },
    getSampleCount:  function() { return this.counts.sampleCount; },
    getTotalSampleCount: function() { return this.counts.totalSampleCount; },
    setSampleCount: function(n) { this.counts.sampleCount = n; this.counts.totalSampleCount += n; return this.counts.sampleCount; },

    setPatientId: function(id) { this.patientId = id; },
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
		    animation: {duration: 0 }, 
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

        for (i=0; i< this.X_POINT_COUNT; i++){
            // prefill the chart with gray nominal data (autoscales)
            this.chartConfig.data.labels.push('0:00');
            this.chartConfig.data.datasets[0].data.push(500);
            // 2nd dataset is for sample highlight bars
    	    // this.chartConfig.data.datasets[1].data.push(500);
        };

	/* Button handlers  */
        document.getElementById("btnHighUpId").addEventListener(
 	    "click", 
   	    function() { 
		rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high+20, rti.pulseapp.patientConfig.low);
	    }, 
   	    false
	);
        document.getElementById("btnHighDownId").addEventListener(
		"click", 
		function() { 
			rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high-20, rti.pulseapp.patientConfig.low);
		}, 
		false
	);
        document.getElementById("btnLowUpId").addEventListener(
 	    "click", 
   	    function() { 
		rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high, rti.pulseapp.patientConfig.low+20);
	    }, 
   	    false
	);
        document.getElementById("btnLowDownId").addEventListener(
		"click", 
		function() { 
			rti.pulseapp.writePatientConfig(rti.pulseapp.patientConfig.high, rti.pulseapp.patientConfig.low-20);
		}, 
		false
	);
	    /*
        document.getElementById("btn50").addEventListener("click", function() { rti.pulseapp.write(50, 1);}, false);
        document.getElementById("btn100").addEventListener("click", function() { rti.pulseapp.write(100, 2);}, false);
        document.getElementById("btn200").addEventListener("click", function() { rti.pulseapp.write(200, 3);}, false);  */

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
        // console.log(sample);
        // remove name/age from HTML 
	    // const PATIENT_ITEM = document.getElementById('patientNameId');
            //let html_name = `${sample.data.FirstName} ${sample.data.LastName} &nbsp; &nbsp; Age: ${sample.data.Age}`;
            //PATIENT_ITEM.innerHTML = html_name;
        // show name/age on chart canvas, instead of in HTML
        let name = `${sample.data.FirstName} ${sample.data.LastName}     Age: ${sample.data.Age}`;
	this.chartConfig.options.scales.xAxes[0].scaleLabel.labelString = name;
        console.log('updatePatientInfo: ' + sample.data.Id.Id);
        this.patientId = sample.data.Id.Id;
    },
    /**
     *  call the methods that update the display 
     */
    run: function() {
        var url = this.getPulseReaderURL();
        const chartUpdateIntervalPeriod = 2000; // in milliseconds 2x data rate

	var configURL = this.getPatientConfigReaderURL();
	    console.log(configURL);
        // Call chartjs() for ecgPulse and bpm every ecgReadIntervalPeriod, passing the data resulting
        // for reading new samples of the appropriate topic in json format without deleting the samples
        // from the Reader's cache.
        setInterval(function(){
            // Read pulse
            $.getJSON(
                url,
                {
                    sampleFormat: "json",
                    removeFromReaderCache: "false",
		    maxSamples: 10,
                },
                function(data) {
		    if (data) {
                        rti.pulseapp.updateChart(data); 
			console.log({bpm: data});
		    } else {
 		        console.log('got empty data' + this.bumpEmptyCnt());
		    }
                }
            );
	// Also update the PatientConfig value
	    $.getJSON(
	      configURL,
	      { sampleFormat:"json", removeFromReaderCache: "false"}, 
	      function(samples) {
                console.log('config: ', samples);
	        if (samples && samples.length) { 
	          let data = samples[0].data;
		  rti.pulseapp.updatePatientConfig(data.PulseHighThreshold, data.PulseLowThreshold);
		}
	      }
	    );
        }, chartUpdateIntervalPeriod);
    },

    /**
     * Updates the chart with the sequence of values
     * @param sampleSeq Sequence of samples to be drawn.
     */

    updateChart: function(sampleSeq) {
        var chartData = this.chartConfig.data.datasets[0].data;
        //var barData   = this.chartConfig.data.datasets[1].data;
        var chartLabels = this.chartConfig.data.labels;
        var lineChart = this.lineChart;

        // how to change the line color in time (can also be changed by value condition)
        // lineChart.config.data.datasets[0].borderColor="rgb(255, 99, 132)";
        // lineChart.config.data.datasets[0].backgroundColor="rgb(255, 99, 132)";
    

        sampleSeq.forEach(function(sample, i, samples) {
            // Process metadata
            
            // console.log("sample", sample);
            // console.log(sample.data.readings.length);

	    var info = sample.read_sample_info;
            var valid_data = info.valid_data;
            var instance_handle = info.instance_handle;
            var instance_state  = info.instance_state;
            var reception_time  = info.source_timestamp;
            //var averageReading;
            rti.pulseapp.setSampleCount(sample.data.readings.length);

            //console.log("sample received:", reception_time);
            // If we received an invalid data sample, and the instance state
            // is != ALIVE, then the instance has been either disposed or
            // unregistered and we ignore the sample.
            if (valid_data && (instance_state == "ALIVE")) {
                if (sample.data.timestamp != rti.pulseapp.prevSampleTimestamp) {
                    rti.pulseapp.prevSampleTimestamp = sample.data.timestamp;
                    // console.log(sample.data.timestamp);
                    // console.log(chartData.length);
                    // console.log(sample.data.readings.length);
                    // console.log(sample.data.readings);

                    sample.data.readings.forEach(function(reading, index){
                        //index += index;
                        if (reading < 100) { return; } //- return from this sample - simple filter to get rid of spikes in the data
                        // Better to fix this at the source (not the browser) or integrate the sample more.

                        chartLabels.shift();
                        chartData.shift();
			//barData.shift();

			            //console.log(reception_time.sec);
		        let dt = new Date (reception_time.sec * 1000);
                        chartLabels.push(('00'+dt.getMinutes()).slice(-2) + ':' + 
				         ('00'+dt.getSeconds()).slice(-2));
                        chartData.push(reading);
			// Enable for bars
			/*if (rti.pulseapp.getUpdateCount() % 2) {
				barData.push(200);
			} else {
				barData.push(999);
			} */

                    });

                    var value = sample.data.bpm;
                    var elementHb = document.getElementById("heartbeatValue");
                    elementHb.innerHTML = value;
	            //console.log("keep ts " + sample.data.timestamp + " rec: " + info.source_timestamp.sec);
	        } else {
	            console.log("drop ts " + sample.data.timestamp + " rec: " + info.source_timestamp.sec);
	        }
            }
		            
            const COUNT_ITEM = document.getElementById("countId");
            COUNT_ITEM.innerHTML = "update count: " + rti.pulseapp.bumpUpdateCount() +
			           " sample count: " + rti.pulseapp.getSampleCount() +
			           " total samples: " + rti.pulseapp.getTotalSampleCount();
        });
                        lineChart.update();
    },
 
    /* update the screen's config */
    updatePatientConfig: function(high, low) {
        console.log({updatePatientConfig:{high: high, low: low}});
        rti.pulseapp.patientConfig.high = high;
        rti.pulseapp.patientConfig.low = low;
	$("#highValueId").prop("innerHTML", high);
	$("#lowValueId").prop("innerHTML", low);

        $('#btnHighUpId').prop("disabled", high > 250);
        $('#btnHighDownId').prop("disabled", high < 100);
        $('#btnLowUpId').prop("disabled", low > 70);
        $('#btnLowDownId').prop("disabled", low < 30);
    },
    /* Write some value back on the PatientConfig topic */
    writePatientConfig: function(highValue, lowValue) {
        console.log({writePatientConfig:{ high: highValue, low: lowValue}});
        const configURL = this.getPatientConfigWriterURL();
        var configData = { 
	  "Id": { "Id": this.patientId }, 
	  "PulseHighThreshold": highValue,
	  "PulseLowThreshold": lowValue,
	};

	var configDataJSON = JSON.stringify(configData);
	console.log(configDataJSON);

        $.ajax({
          url:configURL,
          type:"POST",
          data:configDataJSON,
          contentType:"application/dds-web+json",
          dataType:"json",
          success: function(param){
            console.log("sent " + configDataJSON);
		 
          }
        });
    }, 
}
