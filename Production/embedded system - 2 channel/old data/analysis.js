// -------------------------------- CT VALUE CHART --------------------------------
ct_y_value = 0;

ct_data = JSON.parse(JSON.stringify(fluo_chart.data)); // deep copy of the ct_data object

const ct_line = {
    id: 'ct_line',
    afterDraw(chart) {
        const { ctx, chartArea: { top, right, bottom, left, width, height }, scales: { x, y } } = chart;
        if (ct_y_value != 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(left, y.getPixelForValue(ct_y_value));
            ctx.lineTo(right, y.getPixelForValue(ct_y_value));
            ctx.strokeStyle = '#000000';
            ctx.stroke();
            ctx.restore();
        }
    }
};


const ct_config = {
    type: 'line',
    data: ct_data,
    options: {
        animation: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltips: {
                enabled: false
            }
        }
    },
    plugins: [ct_line]
};


const ct_chart = new Chart(
    document.getElementById('ct-chart'),
    ct_config
);

ct_chart.update();

// draw an horizontal line when user click in the ct-chart
canvas = document.getElementById('ct-chart');
canvas.onclick = function (e) {
    // get the mouse y position
    var rect = canvas.getBoundingClientRect();
    var y = e.clientY - rect.top;
    // get the y value of the chart
    ct_y_value = ct_chart.scales['y'].getValueForPixel(y);
    // update the chart
    ct_chart.update();

    // iterate through the data and find the first x value that is greater than the ct_y_value for each dataset
    for (var i = 0; i < ct_data.datasets.length; i++) {
        var dataset = ct_data.datasets[i];
        var x_value = -1;
        for (var j = 0; j < dataset.data.length; j++) {
            if (dataset.data[j] > ct_y_value) {
                // check the label in ct_data.labels that corresponds to the dataset.data[j] value
                x_value = ct_data.labels[j];
                break;
            }
        }

        /* #region update table */
        // update the table if the x value is found
        var table = document.getElementById("ct-table");
        // push a new row if the table is not full
        if (table.rows.length < 4) {
            var row = table.insertRow(-1);
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            var cell4 = row.insertCell(3);
        } else {
            var row = table.rows[i % 4];
            var cell1 = row.cells[0];
            var cell2 = row.cells[1];
            var cell3 = row.cells[2];
            var cell4 = row.cells[3];
        }

        // cell selection
        if (parseInt(i / 4) == 0) {
            ct_cell = cell2;
            sample_cell = cell1;
        } else {
            ct_cell = cell4;
            sample_cell = cell3;
        }

        sample_cell.innerHTML = dataset.label;
        sample_cell.classList.add("uk-text-small");
        sample_cell.classList.add("uk-text-truncate");

        if (x_value != -1) {
            ct_cell.innerHTML = x_value;
        } else { //if we don't find a value, we write infinite
            ct_cell.innerHTML = "∞";
        }
        /* #endregion */
    }
};

change_left_range(0, document.getElementById('left_range_ct'));
change_right_range(100, document.getElementById('right_range_ct'));

// -------------------------------- MELTING CURVE CHART -------------------------------- //


melting_data = JSON.parse(JSON.stringify(ct_data));


const melting_config = {
    type: 'line',
    data: melting_data,
    options: {
        animation: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltips: {
                enabled: false
            }
        }, 
        elements: {
            line: {
                tension: 0.4
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Temperature (°C)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: '-dF/dT'
                }
            }
        }
    }
};

var melting_chart = new Chart(
    document.getElementById('melting-chart'),
    melting_config
);

window.delta = 10;
function update_melting_chart() {
    melting_data = JSON.parse(JSON.stringify(ct_data));
    window.melting = melting_data;

    // melting_data = generate_sample_data();

    //Substitute the labels by their temperature
    //Search the temperature array until the label is found
    var start_index = 0;
    for (var i = 0; i < temp_chart.data.datasets[0].data.length; i++) {
        if (temp_chart.data.labels[i] == melting_data.labels[0]) {
            start_index = i;
            break;
        }
    }

    // substitute the labels by the target temp
    for (var i = start_index; i < start_index + melting_data.labels.length; i++) {
        var value = temp_chart.data.datasets[4].data[i];
        melting_data.labels[i - start_index] = parseFloat(value.toFixed(2));
    }

    // read the value of the slider "differential-size"
    var differential_size = document.getElementById("differential-size").value;

    // calculate the derivative for each dataset
    for (var i = 0; i < 8; i++) {
        melting_data.datasets[i].data = generateDerivative(melting_data.datasets[i].data, differential_size);
    }   

    

    // iterate through the data and find the peak for each dataset
    for (var i = 0; i < melting_data.datasets.length; i++) {
        var dataset = melting_data.datasets[i];
        
        // get the peak index array
        var peakIndexArray = peakDetection(dataset.data, window.delta);

        // get the corresponding labels for all peaks
        var x_values = peakIndexArray.map(function(index) {
            return melting_data.labels[index];
        });

        // join all labels with commas
        var x_value = x_values.join(", ");


        /* #region update table */
        // update the table if the x value is found
        var table = document.getElementById("peaks-table");
        
        // push a new row if the table is not full
        if (table.rows.length < 4) {
            var row = table.insertRow(-1);
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            var cell4 = row.insertCell(3);
        } else {
            var row = table.rows[i % 4];
            var cell1 = row.cells[0];
            var cell2 = row.cells[1];
            var cell3 = row.cells[2];
            var cell4 = row.cells[3];
        }

        // cell selection
        if (parseInt(i / 4) == 0) {
            peak_cell = cell2;
            sample_cell = cell1;
        } else {
            peak_cell = cell4;
            sample_cell = cell3;
        }

        sample_cell.innerHTML = dataset.label;
        sample_cell.classList.add("uk-text-small");
        sample_cell.classList.add("uk-text-truncate");

        peak_cell.innerHTML = x_value;
        /* #endregion */
    }


    melting_chart.data = melting_data;
    // update the chart
    melting_chart.update();

}

update_melting_chart();

// register update_melting_chart as a callback each time that the slider "differential-size" is changed
document.getElementById("differential-size").addEventListener("input", update_melting_chart);

// create a function to calculate the linnear regression between two arrays of sample data
function regression(x,y) {
    var lr = {};
    var n = y.length;
    var sum_x = 0;
    var sum_y = 0;
    var sum_xy = 0;
    var sum_xx = 0;
    var sum_yy = 0;

    for (var i = 0; i < y.length; i++) {

        sum_x += x[i];
        sum_y += y[i];
        sum_xy += (x[i]*y[i]);
        sum_xx += (x[i]*x[i]);
        sum_yy += (y[i]*y[i]);
    } 

    lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);
    lr['intercept'] = (sum_y - lr.slope * sum_x)/n;
    lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);

    return [lr.slope, lr.intercept, lr.r2];
}

function generateDerivative(inputArr, windowSize) {
    const outputArr = [];

    for (let i = 0; i < inputArr.length; i++) {
        const startIndex = Math.max(i - Math.floor(windowSize/2), 0);
        const endIndex = Math.min(i + Math.ceil(windowSize/2), inputArr.length-1);

        // If the window extends beyond the input array boundaries, set derivative to NaN
        if (startIndex === i || endIndex === i) {
            outputArr.push(NaN);
            continue;
        }

        const leftSum = inputArr.slice(startIndex, i).reduce((a, b) => a + b, 0);
        const leftAvg = leftSum / Math.max(1, i - startIndex);

        const rightSum = inputArr.slice(i+1, endIndex+1).reduce((a, b) => a + b, 0);
        const rightAvg = rightSum / Math.max(1, endIndex - i);

        // Calculate derivative
        const derivative = rightAvg - leftAvg;

        //add the derivative to the output array
        outputArr.push(-derivative);
    }
  
    return outputArr;
}

function peakDetection(signal, delta) {
    let peaks = [];
    const bendThreshold = 0.5;

    // Calculate first derivative
    for (let i = delta; i < signal.length - delta - 1; i++) {
        let v = signal[i];
        let valid = true;
        let bend = 0;

        if ((v > signal[i + 1]) && (v >= signal[i - 1]) && (v > 15)) valid = true;
        else valid = false;

        for (let j = 2; j <= delta; j++) {
            if ((v <= signal[i + j]) || (v <= signal[i - j])) valid = false;
            if (signal[i + j] > 0) {
                bend += Math.abs(signal[i + j] - signal[i + j - 1]);
            }
            if (signal[i - j] > 0) {
                bend += Math.abs(signal[i - j] - signal[i - j + 1]);
            }
        }

        if (bend < bendThreshold) valid = false;

        if (valid) peaks.push(i);
    }

    return peaks;
}



function generate_sample_data() {
    // Settings for the Gaussian distribution
    var center = 40;
    var standardDeviation = 10;

    // Function to get a Gaussian distribution value
    function getGaussian(x) {
        return Math.exp(-Math.pow(x - center, 2) / (2 * Math.pow(standardDeviation, 2)));
    }

    var datasets = [];
    for (var j = 0; j < 8; j++) {
        var data = [];
        for (var i = 1; i <= 95; i++) {
            var y = getGaussian(i);
            data.push(y * 200); // random number between 1 and 200
        }
        datasets.push({
            label: 'Dataset ' + (j + 1),
            borderColor: "#1E87F0",
            backgroundColor: "#1E87F0",
            data: data,
            // Add any additional properties you need for each dataset
        });
    }

    var labels = [];
    for (var i = 1; i <= 95; i++) {
        labels.push(i); // generates an array of integers from 1 to 95
    }

    return {
        labels: labels,
        datasets: datasets,
    };
}

