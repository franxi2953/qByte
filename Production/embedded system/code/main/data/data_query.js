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

//////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////CHART DATA STRUCTURES/////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////

const fluo_data = {
    labels: [],
    datasets: []
};

// add the 8 datasets to fluo_data.datasets 
for (var i = 0; i < 8; i++) {
    fluo_data.datasets.push({
        label: 'PD' + (i + 1),
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





