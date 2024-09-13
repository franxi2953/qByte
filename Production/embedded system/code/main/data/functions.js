// include the libraries on the file
// UIKIT
document.write('<link rel="stylesheet" href="uikit.min.css">');
document.write('<script src="JS_merged.js"></script>');

// global variables 
var sample_table;
var CYCLE_TIME = 60000;
var lid_hot = false;
var first_value = true;
var LID_TEMP = 95;
var LID_DIFF = 5;
var normalization = "Subtract"; // "subtract" or "divide"
window.N = 100;

var initial_values = [1,1,1,1,1,1,1,1]; // initial values for the relative mode
var protocols_library = {}; // protocols library

// Data that does not suffer simplification to be downloaded
var real_data = {
    labels: [],
    datasets: Array(5 + 8).fill(0).map(() => ({ data: [] }))  // 5 temp data + 8 fluo data
};


// Create a 8 values array to store initial values
var initial_values = new Array(8);

// ----------------------------------------------- MESSAGE PROCESSING FUNCTIONS --------------------------------------------------------
function processData(row) {
    const MESSAGE_STRUCTURE = {
        0: 'time_cycle',
        1: 'heater_goal',
        2: 'fluo 1',
        3: 'fluo 2',
        4: 'fluo 3',
        5: 'fluo 4',
        6: 'fluo 5',
        7: 'fluo 6',
        8: 'fluo 7',
        9: 'fluo 8',
        10: 'temp 1',
        11: 'temp 2',
        12: 'temp 3',
        13: 'temp lid',
        14: 'resistance 1',
        15: 'resistance 2',
        16: 'resistance 3',
        17: 'resistance lid',
        18: 'resistance chamber',
        19: 'memory'
    };

    const data = row.split(",");

    // Input validation: 
    // If the row is neither 'start' nor 'stop' and its length does not match the structure, discard it.
    if (!["start", "stop"].includes(row.trim()) && data.length !== Object.keys(MESSAGE_STRUCTURE).length) {
        console.warn("Data length does not match expected structure. Discarding row:", row);
        return null;
    }

    const date = new Date(null);
    date.setSeconds(data[0]/1000); 
    const time = date.toISOString().substr(11, 8); 

    const memory = 100 - parseFloat(data[19].slice(0, -1));
    const temperatures = data.slice(10, 14).map(x => parseFloat(x));
    const targetTemperature = parseFloat(data[1]); // target temperature
    temperatures.push(targetTemperature); // add it to the temperatures array
    const resistances = data.slice(14, 19).map(x => parseFloat(x));
    const lidTemperature = parseFloat(data[13]);
    const fluos = data.slice(2, 10).map(x => parseFloat(x));
    const averageFluo = fluos.reduce((a, b) => a + b, 0) / fluos.length;

    return { time, memory, temperatures, resistances, lidTemperature, fluos, averageFluo };
}

// Function to update chart data
function updateChartsData(chart, index, value) {
    chart.data.datasets[index].data.push(value);
}

// Function to update memory slider
function updateMemorySlider(memory) {
    const memory_slider = document.getElementById("occupiedMemory");
    memory_slider.style.width = memory + 'px';

    if (memory <= 5) {
        memory_slider.style.background = "#FF5579";
        memory_slider.style.width = "100px";
    }
}

// Simplify data to N elements by averaging
function simplifyData(data, labels, N) {
    if (data.length <= N || !document.getElementById("simplify").checked) return { data, labels };
    
    const simplifiedData = [];
    const simplifiedLabels = [];
    const step = Math.floor(data.length / N);

    for (let i = 0; i < data.length - step; i += step) {
        const slice = data.slice(i, i + step);
        const avgData = slice[0].map((_, j) => slice.reduce((sum, val) => sum + val[j], 0) / slice.length);
        simplifiedData.push(avgData);

        // Take the first label of the chunk
        simplifiedLabels.push(labels[i]);
    }

    return { data: simplifiedData, labels: simplifiedLabels };
}

// Main function
function updateData(from_past = false) {
    lid_hot=false;
    const xhttp = new XMLHttpRequest();
    let request = "";
    if (from_past) request = "/last_run_request"
    else request = "/data_request"
    xhttp.open("GET", request , true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            clearCharts();
            const answer = this.responseText;
            if (answer.includes("[ERROR]")) {
                console.log("[ERROR] Protocol not ongoing");
                window.location.reload();
            } else {
                const data = answer.split("\n").filter(line => !(line.includes("start") || line.includes("stop")));
                const processedData = data
                    .map(row => processData(row))
                    .filter(item => item !== null);  // Discard null items

                updateMemorySlider(processedData[processedData.length - 1].memory);

                let tempData = processedData.map(d => d.temperatures);
                let calibrationData = processedData.map(d => d.resistances);
                let filteredData = processedData.filter(d => (d.lidTemperature - LID_TEMP) ** 2 <= LID_DIFF ** 2);
                let fluoData = filteredData.map(d => d.fluos);

                for (let d of tempData) {
                    if (Math.abs(d[3] - LID_TEMP) <= LID_DIFF) {
                        lid_hot = true;
                        break;
                    }
                }

                let tempLabels = processedData.map(d => d.time);
                let calibrationLabels = processedData.map(d => d.time);
                let fluoLabels = filteredData.map(d => d.time);
                real_data.labels = processedData.map(d => d.time);

                const simplifiedTemp = simplifyData(tempData, tempLabels, window.N);
                const simplifiedCalibration = simplifyData(calibrationData, calibrationLabels, window.N);
                const simplifiedFluo = simplifyData(fluoData, fluoLabels, window.N);

                temp_chart.data.labels = simplifiedTemp.labels;
                calibration_chart.data.labels = simplifiedCalibration.labels;
                fluo_chart.data.labels = simplifiedFluo.labels;

                for (let i = 0; i < temp_chart.data.datasets.length; i++) {
                    temp_chart.data.datasets[i].data = simplifiedTemp.data.map(d => d[i]);
                    real_data.datasets[i].data = processedData.map(d => d.temperatures[i]);
                }

                for (let i = 0; i < calibration_chart.data.datasets.length; i++) {
                    calibration_chart.data.datasets[i].data = simplifiedCalibration.data.map(d => d[i]);
                }

                for (let i = 0; i < fluo_chart.data.datasets.length; i++) {
                    fluo_chart.data.datasets[i].data = simplifiedFluo.data.map(d => d[i]);
                    real_data.datasets[i + temp_chart.data.datasets.length].data = processedData.map(d => d.fluos[i]);
                }

                if (answer.includes("stop")) {
                    if (!from_past)
                    {
                        clearInterval(cycle_read);
                        if (document.getElementById("melting").checked) {
                            runTemp.innerHTML = "Run Melting Curve";
                            document.getElementById("melting_label").style.visibility = "visible";
                        } else {
                            runTemp.innerHTML = "Run";
                            document.getElementById("melting_label").style.visibility = "visible";
                        }
                    }
                }

                updateCharts();
            }
        }
    }
}
// --------------------------------------------------------------------------------------------------------------------------------

// Functions to handle the slider that moves between real data and simplified one
function updateGraphsAfterSimplifyChange(isSimplified) {
    // Deep copy real_data to prevent changes in chart from affecting it
    const real_data_copy = {
        labels: JSON.parse(JSON.stringify(real_data.labels)),
        datasets: JSON.parse(JSON.stringify(real_data.datasets))
    };

    // Update the labels and data for each chart
    let DataToUse = isSimplified 
    ? simplifyData(transpose(real_data_copy.datasets.map(dataset => dataset.data)), real_data_copy.labels, window.N) 
    : { labels: real_data_copy.labels, data: real_data_copy.datasets.map(dataset => dataset.data) };

    // If the data was simplified, transpose it back to its original form
    if (isSimplified) {
        DataToUse.data = transpose(DataToUse.data);
    }

    temp_chart.data.labels = DataToUse.labels;
    for (var i = 0; i < temp_chart.data.datasets.length; i++) {
        temp_chart.data.datasets[i].data = DataToUse.data[i];
    }

    fluo_chart.data.labels = DataToUse.labels;
    for (var i = 0; i < fluo_chart.data.datasets.length; i++) {        
        fluo_chart.data.datasets[i].data = DataToUse.data[temp_chart.data.datasets.length + i];
    }

    // Update the charts to reflect the changes
    updateCharts();
}



//simplifyData needs the transposed data as the function was created to simplify incoming .csv data
function transpose(array) {
    return array[0].map((_, colIndex) => array.map(row => row[colIndex]));
}


function updateRelative() {
    if (document.getElementById("relative").checked) {
        // divide each value by the initial value
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < fluo_chart.data.datasets[i].data.length; j++) {
                fluo_chart.data.datasets[i].data[j] = fluo_chart.data.datasets[i].data[j] / initial_values[i];
            }
        }

    } else {
        // multiply each value by the initial value
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < fluo_chart.data.datasets[i].data.length; j++) {
                fluo_chart.data.datasets[i].data[j] = fluo_chart.data.datasets[i].data[j] * initial_values[i];
            }
        }
    }
    
    updateCharts();
}

// Clear charts
function clearCharts() {
        // delete chart.js dataset
        fluo_data.labels = []
        temp_data.labels = []
        calibration_data.labels = []
    
        for (i = 0; i<8; i++) {
            fluo_chart.data.datasets[i].data = []
        }
        
        // delete the data in the temp chart
        for (i = 0; i<temp_chart.data.datasets.length ; i++) 
            temp_chart.data.datasets[i].data = [];
            
        // delete the data in the calibration chart
        for (i = 0; i<calibration_chart.data.datasets.length; i++)
            calibration_chart.data.datasets[i].data = [];
    
        // clear the chart
        fluo_chart.clear();
        temp_chart.clear();
        calibration_chart.clear();

}

function updateCharts()
{
    // obtain the maximun value of the datasets that the labels don't include "Empty"
    let max_value = 0;
    for (let i = 0; i < 8; i++) {
        if (fluo_chart.data.datasets[i].label != "Empty") {
            max_value = Math.max(max_value, Math.max.apply(Math, fluo_chart.data.datasets[i].data));
        }
    }
    // set the y axis limits to the max value + 0.1
    fluo_chart.scales.y.options.max = Math.round(max_value * 1.1);

    // obtain the minimun value of the datasets that the labels don't include "Empty"
    let min_value = Infinity;
    for (let i = 0; i < 8; i++) {
        if (fluo_chart.data.datasets[i].label != "Empty") {
            min_value = Math.min(min_value, Math.min.apply(Math, fluo_chart.data.datasets[i].data));
        }
    }
    // set the y axis limits to the min value - 0.1
    fluo_chart.scales.y.options.min = Math.round(min_value * 0.9)

    // Repeat for the temperature chart
    // obtain the maximun value of the datasets that the labels don't include "Empty"
    max_value = 0;
    for (let i = 0; i < 5; i++) {
        if (temp_chart.data.datasets[i].label != "Empty") {
            max_value = Math.max(max_value, Math.max.apply(Math, temp_chart.data.datasets[i].data));
        }
    }
    // set the y axis limits to the max value + 0.1
    temp_chart.scales.y.options.max = Math.round(max_value * 1.1);

    // obtain the minimun value of the datasets that the labels don't include "Empty"
    min_value = Infinity;
    for (let i = 0; i < 5; i++) {
        if (temp_chart.data.datasets[i].label != "Empty") {
            min_value = Math.min(min_value, Math.min.apply(Math, temp_chart.data.datasets[i].data));
        }
    }
    // set the y axis limits to the min value - 0.1
    temp_chart.scales.y.options.min = Math.round(min_value * 0.9);

    // check if lid_hot is false and runTemp.innerHTML is equal to "Stop"
    if (lid_hot == false && runTemp.innerHTML == "Stop") 
    {
        var ctx = document.getElementById("fluorescence").getContext("2d");
        // console.log("Heating LID");
        ctx.filter = "blur(5px)";
        ctx.opacity = "0.5";
    }

    //re-draw the chart, this time empty
    fluo_chart.update();
    temp_chart.update();
    calibration_chart.update();

    //send the function range change with the actual range values to update the ct_chart
    let ct_left = document.getElementById("left_range_ct").value;
    let ct_right = document.getElementById("right_range_ct").value;

    rangeChange(ct_chart, [ct_left, ct_right]);

    update_melting_chart();

    // check if lid_hot is false and runTemp.innerHTML is equal to "Stop"
    if (lid_hot == false && runTemp.innerHTML == "Stop") 
    {
        // write in the middle of the canvas a text that is not affecter by the blur
        ctx.filter = "none"
        ctx.opacity = "1"
        ctx.font = "30px Arial";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        // find the middle point of the canvas to write the text
        let x = document.getElementById("fluorescence").width / 2;
        let y = document.getElementById("fluorescence").height / 2;
        ctx.fillText("Heating LID", x, y);
        // hide the slider
    }
    
}

// handle the click of set_cycle_time button
function set_cycle_time() {
    var cycle_time = parseInt(document.getElementById("cycle-time").value);
    if (cycle_time < parseInt(document.getElementById("cycle-time").min)) {
        cycle_time = document.getElementById("cycle-time").min;
    }
    cycle_time = cycle_time * 1000;
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/cycle_time?set=" + cycle_time, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("cycle-time").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("cycle-time").classList.remove("uk-form-success");
                }, 1000);
            }

            document.getElementById("cycle-time").innerHTML = cycle_time/1000;
            CYCLE_TIME = parseInt(cycle_time) + DELAY_READ;
            // change cycle_read interval to the new cycle_time if cycle_read is defined
            if (typeof cycle_read !== 'undefined') {
                clearInterval(cycle_read);
            }
            cycle_read = setInterval(updateData, CYCLE_TIME);
        }
    }
}

// calibrate the led weights ON CONSTRUCTION
function calibrate_signal() {
    // Inactivate the button
    document.getElementById("calibrate_signal").disabled = true;
    // show a spinner
    document.getElementById("calibrate_signal").innerHTML = '<span uk-spinner></span> Calibrating...';
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/calibrate_signal", true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText
            console.log(answer)
        }
    }
}

// handle the click of lid-temp-set button
function set_lid_temp() {
    var lid_temp = parseInt(document.getElementById("lid-temp").value);
    if (lid_temp < parseInt(document.getElementById("lid-temp").min)) {
        lid_temp = document.getElementById("lid-temp").min;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/lid_temp?set=" + lid_temp, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("lid-temp").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("lid-temp").classList.remove("uk-form-success");
                }, 1000);
            }

            document.getElementById("lid-temp").innerHTML = lid_temp;
            LID_TEMP = parseInt(lid_temp);
        }
    }
}

// handle the click of lid-diff-set button
function set_lid_diff() {
    var lid_diff = parseInt(document.getElementById("lid-diff").value);
    if (lid_diff < parseInt(document.getElementById("lid-diff").min)) {
        lid_diff = document.getElementById("lid-diff").min;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/lid_diff?set=" + lid_diff, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
                            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("lid-diff").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("lid-diff").classList.remove("uk-form-success");
                }, 1000);
            }

            document.getElementById("lid-diff").innerHTML = lid_diff;
            LID_DIFF = parseInt(lid_diff);
        }
    }
}

// handle the click of step-temp-set button
function set_step_temp() {
    var step_temp = parseInt(document.getElementById("step-temp").value);
    if (step_temp < parseInt(document.getElementById("step-temp").min)) {
        step_temp = document.getElementById("step-temp").min;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/step_temp?set=" + step_temp, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
                            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("step-temp").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("step-temp").classList.remove("uk-form-success");
                }, 1000);
            }

            document.getElementById("step-temp").innerHTML = step_temp;
        }
    }
}

// handle the click of step-time-set button
function set_step_time() {
    var step_time = parseInt(document.getElementById("step-time").value);
    if (step_time < parseInt(document.getElementById("step-time").min)) {
        step_time = document.getElementById("step-time").min;
    }
    step_time = step_time * 1000;
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/melting_time?set=" + step_time, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
                            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("step-time").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("step-time").classList.remove("uk-form-success");
                }, 1000);
            }
            document.getElementById("step-time").innerHTML = step_time/1000;
        }
    }
}

// handle the click of step-temp-set button
function set_step_temp() {
    var step_temp = parseFloat(document.getElementById("step-temp").value);
    if (step_temp < parseInt(document.getElementById("step-temp").min)) {
        step_temp = document.getElementById("step-temp").min;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/melting_step?set=" + step_temp, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
                            // add the class "uk-form-success" to the input field for 1 seconds
                document.getElementById("step-temp").classList.add("uk-form-success");
                setTimeout(function () {
                    document.getElementById("step-temp").classList.remove("uk-form-success");
                }, 1000);
            }

            document.getElementById("step-temp").innerHTML = step_temp;
        }
    }
}

// melting temperature range functions
function change_left_range (temp, slider) {
    slider.value=temp;
    var value=(100/(parseInt(slider.max)-parseInt(slider.min)))*parseInt(slider.value)-(100/(parseInt(slider.max)-parseInt(slider.min)))*parseInt(slider.min);
    var children = slider.parentNode.childNodes[1].childNodes;
    children[1].style.width=value+'%';
    children[5].style.left=value+'%';
    children[7].style.left=value+'%';children[11].style.left=value+'%';
    children[11].childNodes[1].innerHTML=slider.value; 
}

function change_right_range (temp, slider) {
    slider.value=temp;
    var value=(100/(parseInt(slider.max)-parseInt(slider.min)))*parseInt(slider.value)-(100/(parseInt(slider.max)-parseInt(slider.min)))*parseInt(slider.min);
    var children = slider.parentNode.childNodes[1].childNodes;
    children[3].style.width=(100-value)+'%';
    children[5].style.right=(100-value)+'%';
    children[9].style.left=value+'%';children[13].style.left=value+'%';
    children[13].childNodes[1].innerHTML=slider.value;
}

function melting_range_set () {
    var left_range = document.getElementById('left_range');
    var right_range = document.getElementById('right_range');

    var range = left_range.value + "," + right_range.value;

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/melting_range?set=" + range, true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText

            if (answer.includes("[OK]")) {
                //    change the background of div range to green
                document.getElementById("range_bar").style.backgroundColor = "#32d296";
                setTimeout(function () {
                        // remove the background of div range
                        document.getElementById("range_bar").style.backgroundColor = "";
                }, 1000);
            }
        }
    }
}

// download data in JSON or CSV 
// to wait for the answer from the server and then give the user the possibility to change the range

// Save data
function saveProtocolData() {
    //Join the data from real_data
    var data_JSON = {
        labels: real_data.labels,
        datasets: [
            {
                label: 'Wells 1 temp', 
                borderColor: "#1E87F0",
                backgroundColor: "#1E87F0",
                data: real_data.datasets[0].data,
            },
            {
                label: 'Wells 2 temp', 
                borderColor: "#7FD2D1",
                backgroundColor: "#7FD2D1",
                data: real_data.datasets[1].data,
            },
            {
                label: 'Wells 3 temp', 
                borderColor: "#87ba9d",
                backgroundColor: "#87ba9d",
                data: real_data.datasets[2].data,
            },
            {
                label: 'Lid temp', 
                borderColor: "#AB96D2",
                backgroundColor: "#AB96D2",
                data: real_data.datasets[3].data,
            },
            {
                label: 'Target temp',
                data: real_data.datasets[4].data,
                borderColor: "#FF5579",
                backgroundColor: "#FF5579",
            }
        ]
    };

    // add the 8 fluo data to the data_JSON
    for (i = 0; i < 8; i++) {
        data_JSON.datasets[i+5] = {
            label: fluo_chart.data.datasets[i].label + " " + i,	
            data: real_data.datasets[i + 5].data,
            borderColor: fluo_chart.data.datasets[i].borderColor,
            backgroundColor: fluo_chart.data.datasets[i].backgroundColor,
        }   
    }

    var data = JSON.stringify(data_JSON);
    var blob = new Blob([data], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "data.txt");
}


function saveProtocolDataCSV() {
    //Join the data from real_data
    var data_csv = "Time,";
    for (i = 0; i < 8; i++) {
        data_csv += fluo_chart.data.datasets[i].label + ",";
    }
    data_csv += "Wells 1 temp,Wells 2 temp,Wells 3 temp,Lid temp,Target temp\n";

    for (i = 0; i < real_data.labels.length; i++) {
        data_csv += real_data.labels[i] + ",";
        for (j = 0; j < 8; j++) {
            data_csv += real_data.datasets[j].data[i] + ",";
        }
        for (j = 0; j < 5; j++) {
            data_csv += real_data.datasets[j + 8].data[i] + ",";
        }
        data_csv += "\n";
    }

    var blob = new Blob([data_csv], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "data.csv");
}

function saveChartCtCSV() {
    //Join the data from chart_ct
    var data_csv = "Time,";
    for (i = 0; i < 8; i++) {
        data_csv += fluo_chart.data.datasets[i].label + ",";
    }
    data_csv += "Wells 1 temp,Wells 2 temp,Wells 3 temp,Lid temp,Target temp\n";

    for (i = 0; i < ct_chart.data.labels.length; i++) {
        data_csv += ct_chart.data.labels[i] + ",";

        // Find corresponding index in real_data labels
        let real_data_index = real_data.labels.indexOf(ct_chart.data.labels[i]);

        for (j = 0; j < 8; j++) {
            data_csv += ct_chart.data.datasets[j].data[i] + ",";
        }
        
        if(real_data_index != -1) {
            for (j = 0; j < 5; j++) {
                data_csv += real_data.datasets[j].data[real_data_index] + ",";
            }
        } else {
            data_csv += "N/A,N/A,N/A,N/A,N/A,";
        }

        data_csv += "\n";
    }

    var blob = new Blob([data_csv], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "data.csv");
}

function saveMeltingChartCSV() {
    // Join the data from melting_chart
    var data_csv = "Temperature,";
    
    // Add the column headers (assuming that the labels are the same as for the fluo_chart)
    for (i = 0; i < 8; i++) {
        data_csv += fluo_chart.data.datasets[i].label + ",";
    }
    data_csv = data_csv.slice(0, -1);  // Remove trailing comma
    data_csv += "\n";  // Add newline

    for (i = 0; i < melting_chart.data.labels.length; i++) {
        data_csv += melting_chart.data.labels[i] + ",";
        for (j = 0; j < 8; j++) {
            data_csv += melting_chart.data.datasets[j].data[i] + ",";
        }
        data_csv = data_csv.slice(0, -1);  // Remove trailing comma
        data_csv += "\n";  // Add newline
    }

    var blob = new Blob([data_csv], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "melting_data.csv");
}

//Add calibration info to the chart
function addCalibrationInfo() {
        //get the chamber resistance, the metal resistance and the real temp
        var heater1_resistance = calibration_data.datasets[0].data[calibration_data.datasets[0].data.length - 1];
        var heater2_resistance = calibration_data.datasets[1].data[calibration_data.datasets[1].data.length - 1];
        var heater3_resistance = calibration_data.datasets[2].data[calibration_data.datasets[2].data.length - 1];
        var lid_resistance = calibration_data.datasets[3].data[calibration_data.datasets[3].data.length - 1];
        var chamber_resistance = calibration_data.datasets[4].data[calibration_data.datasets[4].data.length - 1];
        var real_temp = document.getElementById("degreesCalibrate").value;
        //add it to the calibration table as a new row
        var calibration_table = document.getElementById("calibration_table");
        var row = calibration_table.insertRow(calibration_table.rows.length);
    
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        var cell4 = row.insertCell(3);
        var cell5 = row.insertCell(4);
        var cell6 = row.insertCell(5);
    
        cell1.innerHTML = heater1_resistance;
        cell2.innerHTML = heater2_resistance;
        cell3.innerHTML = heater3_resistance;
        cell4.innerHTML = lid_resistance;
        cell5.innerHTML = chamber_resistance;
        cell6.innerHTML = real_temp;

}

function saveCalibrationData() {
    var calibration_table = document.getElementById("calibration_table");
    var data_JSON = {
        heater1_resistance: [],
        heater2_resistance: [],
        heater3_resistance: [],
        lid_resistance: [],
        chamber_resistance: [],
        real_temp: [],
    };
    for (var i = 1; i < calibration_table.rows.length; i++) {
        data_JSON.heater1_resistance.push(calibration_table.rows[i].cells[0].innerHTML);
        data_JSON.heater2_resistance.push(calibration_table.rows[i].cells[1].innerHTML);
        data_JSON.heater3_resistance.push(calibration_table.rows[i].cells[2].innerHTML);
        data_JSON.lid_resistance.push(calibration_table.rows[i].cells[3].innerHTML);
        data_JSON.chamber_resistance.push(calibration_table.rows[i].cells[4].innerHTML);
        data_JSON.real_temp.push(calibration_table.rows[i].cells[5].innerHTML);
    }
    var data = JSON.stringify(data_JSON);
    var blob = new Blob([data], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "calibration_data.txt");
}

function rangeChange (chart, range=[0,100]) {
    // create a copy of original data to avoid changing the original data
    var buffer = JSON.parse(JSON.stringify(fluo_chart.data));
    
    var labels_ct = [];

    var max_value = 0;
    var min_value = 1000;

    // access the chart dataset
    for (var i = 0; i < chart.data.datasets.length; i++) {

        var data_ct = [];

        // transform the 0:100 value in a 0:data.length value
        var min = Math.round(range[0] * buffer["datasets"][i]["data"].length / 100);
        var max = Math.round(range[1] * buffer["datasets"][i]["data"].length / 100);

        for (var j = 0; j < buffer["datasets"][i]["data"].length; j++) {
            if (j >= min && j <= max) {
                if (normalization == "Subtract") {
                    if (j == min) {
                        data_ct = data_ct.concat(0);
                    } else {
                        data_ct = data_ct.concat(buffer["datasets"][i]["data"][j]-buffer["datasets"][i]["data"][min]);
                    }
                } else if (normalization == "Division") {
                    if (j == min) {
                        data_ct = data_ct.concat(1);
                    } else {
                        data_ct = data_ct.concat(buffer["datasets"][i]["data"][j]/buffer["datasets"][i]["data"][min]);
                    }
                } else if (normalization =="Min-Max") {
                    let minValue = Math.min(...buffer["datasets"][i]["data"]);
                    let maxValue = Math.max(...buffer["datasets"][i]["data"]);
                    if (maxValue != minValue) {
                        let normalizedValue = (buffer["datasets"][i]["data"][j] - minValue) / (maxValue - minValue) * 100;
                        data_ct = data_ct.concat(normalizedValue);
                    } else {
                        data_ct = data_ct.concat(0); // if max == min, then all values are the same and we can return 0 as normalized value.
                    }
                } else {
                    data_ct = data_ct.concat(buffer["datasets"][i]["data"][j]);
                }
                

                if (i == 0) {
                    labels_ct = labels_ct.concat(buffer["labels"][j]);
                }
            } 
        }

        // update the chart with the new data
        chart.data.datasets[i].data = data_ct;
        chart.data.labels = labels_ct;

        // obtain the maximun value of the datasets that the labels don't include "Empty"
        if (chart.data.datasets[i].label != "Empty") {
            max_value = Math.max(max_value, Math.max.apply(Math, chart.data.datasets[i].data));
        }
        
        
        // obtain the minimun value of the datasets that the labels don't include "Empty"
        if (chart.data.datasets[i].label != "Empty") {
            min_value = Math.min(min_value, Math.min.apply(Math, chart.data.datasets[i].data));
        }

    }

    // Determine a relative padding size based on the range of your data
    let padding = (max_value - min_value) * 0.05; // This will add a 5% padding to your y-axis

    // Set the y axis limits with the calculated padding
    chart.scales.y.options.min = min_value - padding;
    chart.scales.y.options.max = max_value + padding;

    chart.update();

    if(chart == ct_chart) {
        update_melting_chart();
    }
}

function updateNormalization() {
    var slider = document.getElementById("sliderNormalization");
    var operation;
    switch(slider.value) {
      case "1":
        operation = "No";
        break;
      case "2":
        operation = "Subtract";
        break;
      case "3":
        operation = "Division";
        break;
      case "4":
        operation = "Min-Max";
        break;
    }
    normalization = operation;
    // change the value of the div "normalizationValue"
    document.getElementById("normalizationValue").innerHTML = normalization;
    // launch function rangeChange to update the chart
    //send the function range change with the actual range values to update the ct_chart
    var ct_left = document.getElementById("left_range_ct").value;
    var ct_right = document.getElementById("right_range_ct").value;

    rangeChange(ct_chart, [ct_left, ct_right]);
  }

// ------------------------------------------ EXPERIMENT DESIGN DRAWINGS ------------------------------------------

// create a variable to store the sample type of the 8 tubes
var tube_ids = ["Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty"];
// create a dictionary with the possible sample types and their colors
var sample_types = {
    "Empty": "#FFFFFF"
}

var palette = ["#1E87F0", "#FF5579", "#87ba9d", "#F5D372", "#AB96D2","#9CA5B5", "#F09D6C","#7FD2D1"]; //the 8 colors used (maximun number of tubes 8)

var selected_sample = "Empty";

window.onload = function () {
    // --------------------------------------- EXPERIMENT DESIGN DRAWINGS ---------------------------------------
    //draw in the canvas 8 circles in line
    var tubes_canvas = document.getElementById("tubes");
    function drawCircles() {
        var ctx = tubes_canvas.getContext("2d");
        //draw the circles, if the mouse is over the circle, change the color
        for (var i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(50+(i*50), 50, 20, 0, 2 * Math.PI);
            // stroke is grey
            ctx.strokeStyle = "#000000";
            ctx.stroke();
            ctx.fillStyle = sample_types[tube_ids[i]];
            ctx.fill();
            }

        // change the color and name of the charts based in the tube_ids and the sample_types
        for (var i = 0; i < 8; i++) {
            // if the tube is empty, change the color to transparent
            if (tube_ids[i] == "Empty") {
                // change chart.js color to transparent
                fluo_chart.data.datasets[i].backgroundColor = "rgba(0,0,0,0)";
                fluo_chart.data.datasets[i].borderColor = "rgba(0,0,0,0)";
                ct_chart.data.datasets[i].backgroundColor = "rgba(0,0,0,0)";
                ct_chart.data.datasets[i].borderColor = "rgba(0,0,0,0)";
                melting_chart.data.datasets[i].backgroundColor = "rgba(0,0,0,0)";
                melting_chart.data.datasets[i].borderColor = "rgba(0,0,0,0)";

            } else {
                fluo_chart.data.datasets[i].borderColor = sample_types[tube_ids[i]];
                fluo_chart.data.datasets[i].backgroundColor = sample_types[tube_ids[i]];
                ct_chart.data.datasets[i].borderColor = sample_types[tube_ids[i]];
                ct_chart.data.datasets[i].backgroundColor = sample_types[tube_ids[i]];
                melting_chart.data.datasets[i].borderColor = sample_types[tube_ids[i]];
                melting_chart.data.datasets[i].backgroundColor = sample_types[tube_ids[i]];
            }
            fluo_chart.data.datasets[i].label = tube_ids[i];
            ct_chart.data.datasets[i].label = tube_ids[i];
            melting_chart.data.datasets[i].label = tube_ids[i];
        }
        updateCharts();

        }   

    // execute it
    drawCircles();


    //add the event listener to the canvas
    tubes_canvas.addEventListener("mousemove", function(e) {
        var ctx = tubes_canvas.getContext("2d");

        var x = e.clientX - tubes_canvas.offsetLeft;
        var scrolled_distance = window.pageYOffset;
        var y = e.clientY - tubes_canvas.offsetTop + scrolled_distance;
        for (var i = 0; i < 8; i++) {
            ctx.beginPath();
            // if the mouse is over the circle, change the color to selected color
            if (Math.sqrt(Math.pow(x-50-(i*50), 2) + Math.pow(y-50, 2)) < 20) {
                // obtain the next element in the dictionary after the current one and if it is undefined, return the first element
                ctx.fillStyle = sample_types[selected_sample];
                ctx.strokeStyle = sample_types[selected_sample];
            } else { // else, change the color back to its original color
                ctx.fillStyle = sample_types[tube_ids[i]];
                ctx.strokeStyle = sample_types[tube_ids[i]];
            }
            ctx.arc(50+(i*50), 50, 15, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
        }
    }
    , false);	



    // when the mouse click on a circle, change the sample type and the color of the tube
    tubes_canvas.addEventListener("click", function(e) {
        
        var ctx = tubes_canvas.getContext("2d");

        var x = e.clientX - tubes_canvas.offsetLeft;

        var scrolled_distance = window.pageYOffset;
        var y = e.clientY - tubes_canvas.offsetTop + scrolled_distance;
        for (var i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(50+(i*50), 50, 20, 0, 2 * Math.PI);
            ctx.strokeStyle = "#000000";
            ctx.stroke();

            // if the mouse is over the circle, change the color to the next element
            if (Math.sqrt(Math.pow(x-50-(i*50), 2) + Math.pow(y-50, 2)) < 20) {
                tube_ids[i] = selected_sample;
            }
        }
        drawCircles();
        updateSampleTable();
    }
    , false);


    // ------------------------------ EXPERIMENT DESIGN SAMPLE TABLE DRAWINGS ------------------------------
    var sample_canvas = document.getElementById("samples");
    // update the sample table with all the sample_types different than empty
    sample_table = document.getElementById("sample-table");
    
    function updateSampleTable() {
        // console.log("updated");
        // clean the table
        while (sample_table.rows.length > 1) {
            sample_table.deleteRow(1);
        }

        // add one row for each sample type
        for (var i = 0; i < Object.keys(sample_types).length; i++) {
            var row = sample_table.insertRow(sample_table.rows.length);
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            var cell4 = row.insertCell(3);

            // cell1 is composed by an small square with the color of the sample type
            var small_square = document.createElement("canvas");
            small_square.className = "small-square";
            small_square.width = 20;
            small_square.height = 20;
            var small_square_ctx = small_square.getContext("2d");
            small_square_ctx.fillStyle = sample_types[Object.keys(sample_types)[i]];
            small_square_ctx.fillRect(0, 0, 20, 20);
            cell1.appendChild(small_square);

            // cell2 is the name of the sample type
            cell2.innerHTML = Object.keys(sample_types)[i];

            // cell3 is the index of the tubes that have the sample type
            cell3.innerHTML = "";
            for (var j = 1; j < 9; j++) {
                if (tube_ids[j-1] == Object.keys(sample_types)[i]) {
                    cell3.innerHTML += j + " ";
                }
            }


            if (cell2.innerHTML != "Empty") {
                cell4.innerHTML = "<a style=\"text-decoration: none;\">🗑️</a>";
            } else {
                cell4.innerHTML = "";
            }

            //if selected_sample is the same as the sample type, change the color of the row
            if (selected_sample == Object.keys(sample_types)[i]) {
                row.style.backgroundColor = "#E0E0E0";
            }
        }
    } 
    updateSampleTable();

    var add_sample = document.getElementById("add-sample");

    add_sample.onclick = function () { 
        // if the table size is less than 9
        if (Object.keys(sample_types).length < 9) {
            // check the names on the sample types variable. Add a new one which name is "Sample" + the number of the sample types
            var sample_type_names = Object.keys(sample_types);
            
            for (var i = 1; "Sample" + i in sample_types; i++) {
            }

            var sample_type_name = "Sample" + i;

            // select the next color from the variable palette that is not used in the sample_types
            var selected_color = "";

            for (var i = 0; i < palette.length; i++) {
                selected_color = palette[i];
                for (var j = 0; j < sample_type_names.length; j++) {
                    if (palette[i] == sample_types[sample_type_names[j]]) {
                        selected_color="#FFFFFF";
                        break;
                    }
                }
                if (selected_color != "#FFFFFF") {
                    break;
                }
            }

            sample_types[sample_type_name] = selected_color;

            // update the sample table
            updateSampleTable();
        }
    }

    // Sample selection from the table
    sample_table.addEventListener("click", function(e) {
        var row=""
        // if the click was on the small square...
        if (e.target.className == "small-square" || e.target.tagName == "A" ) {
            row = e.target.parentNode.parentNode.rowIndex;
            cell_index = e.target.parentNode.cellIndex;
            selected_sample = sample_table.rows[row-1].cells[1].innerHTML;

            updateSampleTable();

        } else if ( e.target.tagName == "TEXTAREA"){
            row = e.target.parentNode.parentNode.rowIndex;
            cell_index = e.target.parentNode.cellIndex;
        } else {
            // console.log(e.target.tagName);
            row = e.target.parentNode.rowIndex;
            cell_index = e.target.cellIndex;
            selected_sample = sample_table.rows[row-1].cells[1].innerHTML;

            updateSampleTable();
        }
        
        
        
        if (cell_index == 0) {
        } else if (e.target.cellIndex == 1) {
            if (row-1 > 1) {
                // create a text area to change the name of the sample type
                var input = document.createElement("textarea");
                // add uk-input
                input.className = "uk-input";
                // set the value of the input to the content of the cell
                input.defaultValue = sample_table.rows[row-1].cells[1].innerHTML;
                
                input.style.overflow = "hidden";
                input.style.resize = "none";
                input.style.width = "50%";
                input.style.margin = "0px";

                // don't allow to enter "\n"
                input.onkeypress = function(e) {
                    if (e.keyCode == 13) {
                        e.preventDefault();
                    }
                }

                // when the input enters in focus, the cursor is at the end of the text
                input.onfocus = function() {
                    this.selectionStart = this.selectionEnd = this.value.length;
                }

                // replace the content of the cell with the new element
                var former_value = sample_table.rows[row-1].cells[1].innerHTML;
                sample_table.rows[row-1].cells[1].innerHTML = "";
                sample_table.rows[row-1].cells[1].appendChild(input);

                // put the input box on focus
                input.focus();

                    // when the user click outside the input, execute the function close_input
                input.addEventListener("blur", function(e) {
                    close_input(input, former_value);
                }
                , false);
            }
        
        } else if (cell_index == 2) {
        } else if (cell_index == 3) { // DELETE SAMPLE
            if ((row-1)!=1) {
                // change all the circles that have the sample type to empty
                for (var i = 0; i < 8; i++) {
                    if (tube_ids[i] == sample_table.rows[row-1].cells[1].innerHTML) {
                        tube_ids[i] = "Empty";
                    }
                }
                // delete the sample from sample types
                delete sample_types[sample_table.rows[row-1].cells[1].innerHTML];
            }
            drawCircles();
            updateSampleTable();
        }
        
    }
    , false);
    
    function close_input (input, former_value) {

         var buffer_sample_types = {};
        // copy one by one all the values of sample_types
	    for (var i in sample_types) {
		    if (i != former_value) {
			    buffer_sample_types[i] = sample_types[i];
            } else {
			    buffer_sample_types[input.value] = sample_types[former_value];
            }
	    }
		sample_types = buffer_sample_types;

        // change the name of the sample type in the tube_ids array
        for (var i = 0; i < 8; i++) {
            if (tube_ids[i] == former_value) {
                tube_ids[i] = input.value;
            }
        } 

		updateSampleTable();
        drawCircles();
    }

    // ------------------------------ MELTING CURVE ------------------------------
    //SLIDER
    var melting_slider = document.getElementById("melting");
    //when the slider is on, activate the melting mode
    melting_slider.onchange = function() {
        if (melting_slider.checked) {
            document.getElementById("cycle").style.visibility = "hidden";
            // remove the element "degrees"
            document.getElementById("degrees").remove();
            //change the innerHTML of the button with id melting to "Run Melting Curve"
            document.getElementById("temp").innerHTML = "Run Melting Curve";
        } else {
            document.getElementById("cycle").style.visibility = "visible";
            // add the element "degrees" before the button with id temp
            degrees_html = "<input type=\"Number\" class=\"uk-input uk-form-width-xsmall\" style=\"margin-right:2px;\" pattern=\"^[0-9]{1,2}$/\" placeholder=\"ºC\" id=\"degrees\">";
            document.getElementById("temp").insertAdjacentHTML("beforebegin", degrees_html);
            //change the innerHTML of the button with id melting to "Run"
            document.getElementById("temp").innerHTML = "Run";
        }
    }

    // ------------------------------ sliders ------------------------------
    function move_left_range () {
        
        this.value=Math.min(this.value,this.parentNode.childNodes[5].value-1);
        var value=(100/(parseInt(this.max)-parseInt(this.min)))*parseInt(this.value)-(100/(parseInt(this.max)-parseInt(this.min)))*parseInt(this.min);
        var children = this.parentNode.childNodes[1].childNodes;
        children[1].style.width=value+'%';
        children[5].style.left=value+'%';
        children[7].style.left=value+'%';children[11].style.left=value+'%';
        children[11].childNodes[1].innerHTML=this.value;

        // get the id of the slider
        var slider_id = this.id;
        var right_range_value = this.parentNode.childNodes[5].value;

        if (slider_id == "left_range_ct") {
            rangeChange(ct_chart, [this.value, right_range_value]);
        }
    }
    
    document.getElementById('left_range').oninput = move_left_range;
    document.getElementById('left_range_ct').oninput = move_left_range;

    function move_right_range () {
        this.value=Math.max(this.value,this.parentNode.childNodes[3].value-(-1));
        var value=(100/(parseInt(this.max)-parseInt(this.min)))*parseInt(this.value)-(100/(parseInt(this.max)-parseInt(this.min)))*parseInt(this.min);
        var children = this.parentNode.childNodes[1].childNodes;
        children[3].style.width=(100-value)+'%';
        children[5].style.right=(100-value)+'%';
        children[9].style.left=value+'%';children[13].style.left=value+'%';
        children[13].childNodes[1].innerHTML=this.value;

        // get the id of the slider
        var slider_id = this.id;
        var left_range_value = this.parentNode.childNodes[3].value;

        if (slider_id == "right_range_ct") {
            rangeChange(ct_chart, [left_range_value, this.value]);
        }
    }

    document.getElementById('right_range').oninput = move_right_range;
    document.getElementById('right_range_ct').oninput = move_right_range;

    fluo_chart.scales.y.options.max = 10;
    fluo_chart.scales.y.options.min = 0;
    temp_chart.scales.y.options.max = 10;
    temp_chart.scales.y.options.min = 0;

    fluo_chart.update();
    temp_chart.update();

    // ------------------------------  PROTOCOLS DESIGN MENU  ------------------------------

    
    //ask for the protocols library
    var xhttp_9 = new XMLHttpRequest();
    xhttp_9.open("GET", "/protocols", true);
    // xhttp_9.open("GET", "http://localhost:3000/api/path" , true);
    xhttp_9.send();
    xhttp_9.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText
            //the answer is a JSON string with the protocols inside
            var protocols = JSON.parse(answer);
            // log in the console the protocols
            protocols_library = protocols;
            update_protocol_list();
        }
    }

    function update_protocol_list ()
    {
        // for each element of the protocols_library, add a the name of the protocol in the <tbody id="protocol_library">
        var protocol_library_html = document.getElementById("protocol_library");
        // clean the table
        while (protocol_library_html.rows.length > 1) {
            protocol_library_html.deleteRow(1);
        }

        for (var i = 0; i < Object.keys(protocols_library).length; i++) {
            var row = protocol_library_html.insertRow(protocol_library_html.rows.length);
            var cell1 = row.insertCell(0);

            cell1.innerHTML = Object.keys(protocols_library)[i];
            // when a user click on a protocol, go over the "samples" element
            cell1.onclick = ((index) => () => manage_protocol_click(Object.keys(protocols_library)[index]))(i);
        }
    }

    function manage_protocol_click (name) {
        for (var j=0; j< Object.keys(protocols_library[name]["samples"]).length; j++)
        {
            //  in protocols_library[i]["samples"] are the different samples. 
            // protocols_library[i]["samples"][v][0] is the color of the sample
            // protocols_library[i]["samples"][v][1] is the tubes (1-8) that have the sample
            // v is the name of the sample
            //  we need to iterate over all the v and add each sample to the Sample Table
    
            // clean the table
            var sample_table = document.getElementById("sample-table");
            while (sample_table.rows.length > 2) {
                sample_table.deleteRow(2);
                // delete second element of sample_types
                delete sample_types[Object.keys(sample_types)[1]];
            }
            
    
            for (var v=0; v< Object.keys(protocols_library[name]["samples"]).length; v++)
            {
                if (!(Object.keys(protocols_library[name]["samples"])[v] === undefined)) {
                    new_sample_name = Object.keys(protocols_library[name]["samples"])[v];
                    // add the sample to the sample_types
                    sample_types[new_sample_name] = protocols_library[name]["samples"][new_sample_name][0];
                    tubes_to_fill = protocols_library[name]["samples"][new_sample_name][1]
                    // change the tubes of "tube_ids" with the index tubes_to_fill to the new_sample_name
                    if (Object.keys(protocols_library[name]["samples"])[v] == "test2")
                    {
                        console.log(tubes_to_fill);
                    }
                    for (var i = 0; i < 8; i++) {
                        if (tubes_to_fill.includes(i)) {
                            tube_ids[i] = new_sample_name;
                        }
                    }
                }
            }
            // console.log(tube_ids);
            drawCircles();
            updateSampleTable();
        }
    }

    // ----------------------------- SIMPLIFY CHART -----------------------------------------
    // Get the checkbox
    document.getElementById('simplify').addEventListener('change', function() {
        const isSimplified = this.checked;
        updateGraphsAfterSimplifyChange(isSimplified);
    });

    // ----------------------------- LOAD LAST RUN -----------------------------------------
    document.getElementById("last_run_load").addEventListener("click", function() {
        updateData(true);
    });
    
}

// Check if a protocol is ongoing
function isProtocolOngoing() {

    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/OnGoing", true);
    xhttp.send();
    xhttp.onreadystatechange = function () {
        
        if (this.readyState == 4 && this.status == 200) {
            var answer = this.responseText
            if (answer.includes("1")) {
                console.log("[WARNING]] Experiment ongoing");
                // make content with id="options" visible
                runTemp.innerHTML = "Stop";

                updateData();
                
            } else {
                console.log("[INFO] No experiment ongoing");
            }
            
            // ask for the cycle_time and change the value of the cycle_time input
            var xhttp_2 = new XMLHttpRequest();
            xhttp_2.open("GET", "/cycle_time", true);
            xhttp_2.send();
            xhttp_2.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // change the placeholder of the cycle_time input
                    document.getElementById("cycle-time").value = parseInt(answer)/1000;
                    if (parseInt(answer) < 5000) {
                        CYCLE_TIME = 5000;
                    } else {
                        CYCLE_TIME = parseInt(answer) + DELAY_READ;
                    }
                    if (runTemp.innerHTML == "Stop") { //start the protocol with the new cycle_time
                        cycle_read = setInterval(updateData, CYCLE_TIME);
                    }
                }
            }

            // attach the function to the button
            document.getElementById("cycle-time-set").onclick = set_cycle_time;
            
            // ask for the weights ON DEVELOPMENT
            var xhttp_3 = new XMLHttpRequest();
            xhttp_3.open("GET", "/weights" , true);
            xhttp_3.send();
            xhttp_3.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // split the answer by commas
                    var weights = answer.split(",");
                    // if there are 8 values input them in the table
                    weights_table = document.getElementById("weights-table");
                    if (weights.length == 8) {
                        for (var i = 0; i < 8; i++) {
                            weights_table.rows[1].cells[i].innerHTML = weights[i];
                        }
                    }
                }
            }

            document.getElementById("calibrate_signal").onclick = calibrate_signal;

            // ask for the lid_temp
            var xhttp_4 = new XMLHttpRequest();
            xhttp_4.open("GET", "/lid_temp", true);
            xhttp_4.send();
            xhttp_4.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // change the placeholder of the lid-temp input
                    document.getElementById("lid-temp").value = answer;
                    LID_TEMP = parseInt(answer);
                }
            }
            // attach the function to the button
            document.getElementById("lid-temp-set").onclick = set_lid_temp;

            // ask for the lid_diff
            var xhttp_5 = new XMLHttpRequest();
            xhttp_5.open("GET", "/lid_diff", true);
            xhttp_5.send();
            xhttp_5.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // change the placeholder of the lid-diff input
                    document.getElementById("lid-diff").value = answer;
                    LID_DIFF = parseInt(answer);
                }
            }
            // attach the function to the button
            document.getElementById("lid-diff-set").onclick = set_lid_diff;

            // ask for temp step
            var xhttp_6 = new XMLHttpRequest();
            xhttp_6.open("GET", "/melting_step", true);
            xhttp_6.send();
            xhttp_6.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // change the placeholder of the melting-step input
                    document.getElementById("step-temp").value = answer;
                }
            }
            // attach the function to the button
            document.getElementById("melting-step-set").onclick = set_step_temp;

            // ask for the melting step time
            var xhttp_7 = new XMLHttpRequest();
            xhttp_7.open("GET", "/melting_time", true);
            xhttp_7.send();
            xhttp_7.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // change the placeholder of the melting-time input
                    document.getElementById("step-time").value = parseInt(answer)/1000;
                }
            }
            // attach the function to the button
            document.getElementById("melting-step-time-set").onclick = set_step_time;
            
            // ask for the melting temperature ranges
            var xhttp_8 = new XMLHttpRequest();
            xhttp_8.open("GET", "/melting_range" , true);
            xhttp_8.send();
            xhttp_8.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText
                    // split the answer by commas
                    var ranges = answer.split(",");
                    // change the slider ranges to the values received
                    if (ranges.length == 2) {
                        change_left_range(ranges[0], document.getElementById("left_range"));
                        change_right_range(ranges[1], document.getElementById("right_range"));
                    } else {
                        console.log("[ERROR] Wrong number of melting ranges");
                    }
                }
            }

            document.getElementById("melting-range-set").onclick = melting_range_set;

        
            // update visibility for each element with class "options"
            var options = document.getElementsByClassName("options");
            for (var i = 0; i < options.length; i++) {
                options[i].style.visibility = "visible";
            }

            var xhttp_9 = new XMLHttpRequest();
            xhttp_9.open("GET", "/free_memory" , true);
            xhttp_9.send();
            xhttp_9.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    var answer = this.responseText

                    var memory_slider = document.getElementById("occupiedMemory");
                    memory_slider.style.width = 100-parseFloat(answer.slice(0, -1)) + 'px';

                    if (parseFloat(answer.slice(0, -1)) <= 5)
                    {
                        memory_slider.style.background = "#FF5579"
                    }
                }
            }

        }
    }


}





