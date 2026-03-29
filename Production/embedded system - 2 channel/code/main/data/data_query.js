DELAY_READ = 500;


isProtocolOngoing();

// LED button action
var time_running = 0;
var CYCLE = document.getElementById("cycle");

CYCLE.onclick = function () {

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/manual_cycle", false);
    xhttp.send();
    var answer = xhttp.responseText;
    if (answer.includes("[ERROR]")) {
        console.log("[ERROR] Could not start cycle");
    } else {
        // wait one second
        setTimeout(function () {
            // update the data
            updateData();
        }, 3000);

    }
}

// Run/Run Melting/Stop button action
var target_temp = 0;
var runTemp = document.getElementById('temp');
runTemp.onclick = function () {
    if (runTemp.innerHTML == "Run") {
        
        clearCharts();
        updateCharts();

        // hide the melting curve button
        document.getElementById("melting_label").style.visibility = "hidden";

        target_temp = document.getElementById("degrees").value
        var start_program = "/Run?degrees=" + target_temp;
        
        // send a GET request to the URL "/Run?degrees=50"
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", start_program, true);
        xhttp.send();

        // when we receive the OK
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var answer = xhttp.responseText;
                if (answer.includes("[ERROR]")) {
                    console.log("[ERROR] Could not start program");
                } else if (answer.includes("[OK]")) {
                    // set an interval to update the data
                    if (typeof cycle_read ==! undefined) clearInterval(cycle_read);
                    cycle_read = setInterval(updateData, CYCLE_TIME);
                    runTemp.innerHTML = "Stop";
                }
            }
        }
    } else if (runTemp.innerHTML == "Run Melting Curve") {
        clearCharts();
        updateCharts();

        // hide the melting curve button
        document.getElementById("melting_label").style.visibility = "hidden";

        var start_program = "/RunMelting";
        
        // send a GET request to the URL "/Run?degrees=50"
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", start_program, true);
        xhttp.send();

        // when we receive the OK
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var answer = xhttp.responseText;
                if (answer.includes("[ERROR]")) {
                    console.log("[ERROR] Could not start program");
                } else if (answer.includes("[OK]")) {
                    // set an interval to update the data
                    if (typeof cycle_read ==! undefined) clearInterval(cycle_read);
                    cycle_read = setInterval(updateData, CYCLE_TIME);
                    runTemp.innerHTML = "Stop";
                }
            }
        }
    } else {
        // stop the interval function
        clearInterval(cycle_read);
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", "/Stop", true);
        xhttp.send();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var answer = xhttp.responseText;
                if (answer.includes("[ERROR]")) {
                    console.log("[ERROR] Could not stop program");
                } else if (answer.includes("[OK]")) {
                    if (document.getElementById("melting").checked) {
                        runTemp.innerHTML = "Run Melting Curve";
                        document.getElementById("melting_label").style.visibility = "visible";
                    } else {
                        runTemp.innerHTML = "Run";
                        document.getElementById("melting_label").style.visibility = "visible";
                    }
                }
            }
        }
    }
}


var Download_rdml = document.getElementById("download_rdml");
Download_rdml.onclick = saveProtocolDataRDML;

//save the chart data in a local file
var Download = document.getElementById("download");

// download the JSON file with the dataset
Download.onclick = saveProtocolData;

//save csv file with the data of the protocol
var Download_csv = document.getElementById("download_csv");

// download the csv file with the dataset
Download_csv.onclick = saveProtocolDataCSV;

//save csv file with the data of the protocol
var Download_chartct = document.getElementById("download_chartct");

// download the csv file with the dataset
Download_chartct.onclick = saveChartCtCSV;

//save csv file with the data of the protocol
var Download_melting = document.getElementById("download_melting");

// download the csv file with the dataset
Download_melting.onclick = saveMeltingChartCSV;

//Add calibration data when the button is pressed
var calibration_button = document.getElementById("calibrate");
calibration_button.onclick = addCalibrationInfo;

//Dowload the data of the calibration_table as a JSON file
var Download_calibration = document.getElementById("download_calibration");
Download_calibration.onclick = saveCalibrationData;

document.getElementById("calibrate_signal").onclick = function() {
    let calibrateButton = this;
    // Disable button and show spinner.
    calibrateButton.disabled = true;
    calibrateButton.innerHTML = '<span uk-spinner></span> Calibrating...';

    // Step 1: Retrieve initial fluorescence from /fluo.
    let xhrInitial = new XMLHttpRequest();
    xhrInitial.open("GET", "/ReadFluo", true);
    xhrInitial.send();
    xhrInitial.onreadystatechange = function() {
        if (xhrInitial.readyState === 4 && xhrInitial.status === 200) {
            // cycle of reading the data happening. Wait for the data to be ready
            // wait 5 seconds
            setTimeout(function () {
                // now ask for the values in the endpoint /fluo
                let xhr = new XMLHttpRequest();
                xhr.open("GET", "/fluo", true);
                xhr.send();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        let response = xhr.responseText;
                        let values = parseCSVResponse(response);
                        // Update the initial fluorescence chart.
                        for (let i = 0; i < values.length; i++) {
                            initialSignalFluoChart.data.datasets[0].data[i] = values[i];
                        }
                        initialSignalFluoChart.update();

                        // now launch the calibration
                        let xhrCalibrate = new XMLHttpRequest();
                        xhrCalibrate.open("GET", "/Calibration", true);
                        xhrCalibrate.send();
                        xhrCalibrate.onreadystatechange = function() {
                            if (xhrCalibrate.readyState === 4 && xhrCalibrate.status === 200) {

                                // wait 60 seconds
                                setTimeout(function () {
                                    // ask for the weights at "/readWeights"
                                    let xhrWeights = new XMLHttpRequest();
                                    xhrWeights.open("GET", "/readWeights", true);
                                    xhrWeights.send();
                                    xhrWeights.onreadystatechange = function() {
                                        if (xhrWeights.readyState === 4 && xhrWeights.status === 200) {
                                            let response = xhrWeights.responseText;
                                            let values = parseCalibrationResponse(response);
                                            // Update the final LED weights chart.
                                            for (let i = 0; i < values.length; i++) {
                                                finalSignalWeightsChart.data.datasets[0].data[i] = values[i];
                                            }
                                            finalSignalWeightsChart.update();
                                        }

                                        // now read the fluorescence data again
                                        let xhrPost = new XMLHttpRequest();
                                        xhrPost.open("GET", "/ReadFluo", true);
                                        xhrPost.send();
                                        xhrPost.onreadystatechange = function() {
                                            if (xhrPost.readyState === 4 && xhrPost.status === 200) {
                                                // cycle of reading the data happening. Wait for the data to be ready
                                                // wait 5 seconds
                                                setTimeout(function () {
                                                    // now ask for the values in the endpoint /fluo
                                                    let xhr = new XMLHttpRequest();
                                                    xhr.open("GET", "/fluo", true);
                                                    xhr.send();
                                                    xhr.onreadystatechange = function() {
                                                        if (xhr.readyState === 4 && xhr.status === 200) {
                                                            let response = xhr.responseText;
                                                            let values = parseCSVResponse(response);
                                                            // Update the post-calibration fluorescence chart.
                                                            for (let i = 0; i < values.length; i++) {
                                                                postSignalFluoChart.data.datasets[0].data[i] = values[i];
                                                            }
                                                            postSignalFluoChart.update();
                                                        }
                                                    }
                                                    // restore the button
                                                    calibrateButton.disabled = false;
                                                    calibrateButton.innerHTML = "Calibrate Signal";
                                                }, 10000);
                                            }
                                        };
                                    }
                                }, 60000);
                            }
                        };

                    }
                }
            }, 10000);
        }
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////CHART DATA STRUCTURES/////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////

const fluo_data = {
    labels: [],
    datasets: []
};

// add the 48 datasets to fluo_data.datasets 
for (var i = 0; i < 48; i++) {
    fluo_data.datasets.push({
        label: 'Chan ' + (i + 1),
        borderColor: "#FF5579",
        backgroundColor: "#FF5579",
        data: [],
    });
}

const temp_data = {
labels: [],
datasets: [{
    label: 'Well seg. 1', 
    borderColor: "#1E87F0",
    backgroundColor: "#1E87F0",
    data: [],
},
{
    label: 'Well seg. 2', 
    borderColor: "#AB96D2",
    backgroundColor: "#AB96D2",
    data: [],
},
{
    label: 'Well seg. 3', 
    borderColor: "#87ba9d",
    backgroundColor: "#87ba9d",
    data: [],
},
{
    label: 'Lid', 
    borderColor: "#F5D372",
    backgroundColor: "#F5D372",
    data: [],
},
{
    label: 'Target',
    borderColor: "#FF5579",
    backgroundColor: "#FF5579",
    data: [],
}]
};


const calibration_data = {
labels: [],
datasets: [{
    label: 'Well seg. 1 resistance', 
    borderColor: "#1E87F0",
    backgroundColor: "#1E87F0",
    data: [],
},
{
    label: 'Well seg. 2 resistance', 
    borderColor: "#FF5579",
    backgroundColor: "#FF5579",
    data: [],
},
{
    label: 'Well seg. 3 resistance', 
    borderColor: "#87ba9d",
    backgroundColor: "#87ba9d",
    data: [],
},
{
    label: 'Lid resistance', 
    borderColor: "#F5D372",
    backgroundColor: "#F5D372",
    data: [],
},
{
    label: 'Chamber resistance',
    borderColor: "#00A884",
    backgroundColor: "#00A884",
    data: [],
}]
};

const fluo_config = {
type: 'line',
data: fluo_data,
options: {
    animation: false,
    plugins: {
        legend: {
            display: false,
        },
        tooltips: {
            enabled: false
        },
    },
    elements: {
        line: {
            tension: 0.4
        }
    }
}
};

const temp_config = {
type: 'line',
data: temp_data,
options: {
    animation: false,
    elements: {
        line: {
            tension: 0.4
        }
    }
}
};

const calibration_config = {
type: 'line',
data: calibration_data,
options: {
    animation: false, 
    elements: {
        line: {
            tension: 0.4
        }
    }
}
};

// Vertical bar chart for initial fluorescence.
const signalFluo_data = {
    labels: ['PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8'],
    datasets: [{
        label: 'Initial Signal Fluorescence',
        data: [],
        backgroundColor: "#FF5579",
        borderColor: "#FF5579"
    }]
};

const signalFluo_config = {
    type: 'bar',
    data: signalFluo_data,
    options: {
        scales: {
            x: {
                grid: { display: false }  // disable grid lines on x-axis
            },
            y: {
                beginAtZero: true,
                grid: { display: false }  // disable grid lines on y-axis
            }
        },
        animation: false,
        plugins: {
            legend: { display: true },
            tooltips: { enabled: false }
        }
    }
};


// Horizontal bar chart for final LED weights.
const signalWeights_data = {
    labels: ['LED1', 'LED2', 'LED3', 'LED4', 'LED5', 'LED6', 'LED7', 'LED8'],
    datasets: [{
        label: 'Final Signal Weights (%)',
        data: [],
        backgroundColor: "#1E87F0",
        borderColor: "#1E87F0"
    }]
};

const signalWeights_config = {
    type: 'bar',
    data: signalWeights_data,
    options: {
        indexAxis: 'y',
        scales: {
            x: {
                beginAtZero: true,
                max: 100,
                grid: { display: false }
            },
            y: {
                grid: { display: false }
            }
        },
        animation: false,
        plugins: {
            legend: { display: true },
            tooltips: { enabled: false }
        }
    }
};


// Vertical bar chart for post-calibration fluorescence.
const postSignalFluo_data = {
    labels: ['PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8'],
    datasets: [{
        label: 'Post Calibration Fluorescence',
        data: [],
        backgroundColor: "#FF5579",
        borderColor: "#FF5579"
    }]
};

const postSignalFluo_config = {
    type: 'bar',
    data: postSignalFluo_data,
    options: {
        scales: {
            x: {
                grid: { display: false }  // disable grid lines on x-axis
            },
            y: {
                beginAtZero: true,
                grid: { display: false }  // disable grid lines on y-axis
            }
        },
        animation: false,
        plugins: {
            legend: { display: true },
            tooltips: { enabled: false }
        }
    }
};


const fluo_chart = new Chart(
document.getElementById('fluorescence'),
fluo_config
);

window.chart = fluo_chart;

const temp_chart = new Chart(
    document.getElementById('temperature'),
    temp_config
    );

const calibration_chart = new Chart(
    document.getElementById('calibration'),
    calibration_config
    );

const initialSignalFluoChart = new Chart(
    document.getElementById('initialFluorescenceChart'),
    signalFluo_config
    );

const finalSignalWeightsChart = new Chart(
    document.getElementById('finalWeightsChart'), 
    signalWeights_config
    );

const postSignalFluoChart = new Chart(
    document.getElementById('postFluorescenceChart'),
     postSignalFluo_config
    );

/////////////////////////////////////////////////////////////////////////////////////////////
// Helper Functions
/////////////////////////////////////////////////////////////////////////////////////////////

function parseCSVResponse(response) {
    return response.split(",")
                   .filter(item => item.trim() !== "")
                   .map(Number);
}

// Helper: Parse the calibration response (expected format: "[OK],w1,w2,...,w8") into an array of numbers.
function parseCalibrationResponse(response) {
    let parts = response.split(",").filter(item => item.trim() !== "");
    parts.shift(); // Remove the "[OK]" element.
    return parts.map(Number);
}




