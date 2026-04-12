const PALETTES = {
  macos: ["#0A84FF", "#30D158", "#FF9F0A", "#FF375F", "#64D2FF", "#BF5AF2", "#FFD60A", "#5E5CE6"],
  viridis: ["#440154", "#482878", "#3E4989", "#31688E", "#26828E", "#1F9E89", "#35B779", "#6DCD59"],
  plasma: ["#0D0887", "#5B02A3", "#8B0AA5", "#B83289", "#DB5C68", "#F48849", "#FDCA26", "#F0F921"],
  ocean: ["#003049", "#005F73", "#0A9396", "#94D2BD", "#E9D8A6", "#EE9B00", "#CA6702", "#BB3E03"]
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

class FoldPanel {
  constructor(scene, cfg) {
    this.scene = scene;
    this.x = cfg.x;
    this.y = cfg.y;
    this.width = cfg.width;
    this.height = cfg.height;
    this.collapsedWidth = cfg.collapsedWidth || 36;
    this.title = cfg.title;
    this.side = cfg.side;
    this.expanded = true;
    this.onToggle = cfg.onToggle;

    this.g = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, this.title, {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontSize: "13px",
      color: "#e8f2ff",
      fontStyle: "700"
    });

    this.hit = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
    this.hit.on("pointerdown", () => this.toggle());
    this.render();
  }

  getCurrentWidth() {
    return this.expanded ? this.width : this.collapsedWidth;
  }

  toggle() {
    this.expanded = !this.expanded;
    this.render();
    if (this.onToggle) {
      this.onToggle(this.expanded);
    }
  }

  setRect(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.render();
  }

  render() {
    const w = this.getCurrentWidth();
    const h = this.height;
    const radius = this.expanded ? 12 : 8;

    this.g.clear();
    this.g.fillStyle(0x171a22, 0.94);
    this.g.fillRoundedRect(this.x, this.y, w, h, radius);
    this.g.lineStyle(1, 0xffffff, 0.15);
    this.g.strokeRoundedRect(this.x, this.y, w, h, radius);

    this.titleText.setText(this.title);
    this.titleText.setPosition(this.x + 12, this.y + 8);
    this.titleText.setVisible(this.expanded);

    const arrowX = this.side === "left" ? this.x + w - 14 : this.x + 14;
    const arrowY = this.y + 17;

    this.g.fillStyle(0xd8e5ff, 0.95);
    if (this.side === "left") {
      if (this.expanded) {
        this.g.fillTriangle(arrowX + 4, arrowY - 6, arrowX + 4, arrowY + 6, arrowX - 4, arrowY);
      } else {
        this.g.fillTriangle(arrowX - 4, arrowY - 6, arrowX - 4, arrowY + 6, arrowX + 4, arrowY);
      }
    } else if (this.expanded) {
      this.g.fillTriangle(arrowX - 4, arrowY - 6, arrowX - 4, arrowY + 6, arrowX + 4, arrowY);
    } else {
      this.g.fillTriangle(arrowX + 4, arrowY - 6, arrowX + 4, arrowY + 6, arrowX - 4, arrowY);
    }

    this.hit.setPosition(this.x + w / 2, this.y + 17);
    this.hit.setSize(w, 32);
  }
}

class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });

    this.state = {
      loaded: false,
      labels: [],
      fluoSeries: [],
      tempSeries: [],
      fluoKeys: [],
      tempKeys: [],
      fileName: "",
      samples: [],
      tab: "fluo"
    };

    this.mainChart = null;
    this.leftPanel = null;
    this.rightPanel = null;
    this.topBar = null;
    this.tabButtons = {};
    this.ctThresholdY = null;
  }

  create() {
    this.buildBackground();
    this.buildTopBar();

    this.leftPanel = new FoldPanel(this, {
      x: 16,
      y: 74,
      width: 300,
      height: this.scale.height - 90,
      title: "Samples",
      side: "left",
      onToggle: (expanded) => this.onPanelToggle("left", expanded)
    });

    this.rightPanel = new FoldPanel(this, {
      x: this.scale.width - 316,
      y: 74,
      width: 300,
      height: this.scale.height - 90,
      title: "Analysis",
      side: "right",
      onToggle: (expanded) => this.onPanelToggle("right", expanded)
    });

    this.buildTabButtons();
    this.bindDom();
    this.dom.left.classList.remove("hidden");
    this.dom.right.classList.remove("hidden");
    this.createChart();
    this.syncLayout();

    this.scale.on("resize", () => {
      this.syncLayout();
      this.updateChart();
    });
  }

  buildBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a111b, 0x0a111b, 0x0e1b2c, 0x0e1b2c, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);

    const nebula = this.add.graphics();
    nebula.fillStyle(0x2f86ff, 0.08);
    nebula.fillCircle(180, 120, 190);
    nebula.fillStyle(0x24a38f, 0.08);
    nebula.fillCircle(this.scale.width - 120, this.scale.height - 80, 220);
  }

  buildTopBar() {
    this.topBar = this.add.graphics();
    this.redrawTopBar();

    this.add.text(20, 20, "qByte", {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontSize: "28px",
      fontStyle: "700",
      color: "#f3f9ff"
    });

    this.add.text(20, 48, "Processed Fluo and Melting Analyzer", {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontSize: "12px",
      color: "#9fb1ca"
    });

    this.makeButton(this.scale.width - 188, 24, 164, 30, "Load CSV", () => {
      const input = document.getElementById("csv-file");
      input.click();
    });
  }

  redrawTopBar() {
    this.topBar.clear();
    this.topBar.fillStyle(0x121a27, 0.95);
    this.topBar.fillRect(0, 0, this.scale.width, 64);
    this.topBar.lineStyle(1, 0xffffff, 0.12);
    this.topBar.lineBetween(0, 64, this.scale.width, 64);
  }

  buildTabButtons() {
    this.tabButtons.fluo = this.makeButton(this.scale.width / 2 - 158, 18, 150, 28, "Processed Fluo", () => {
      this.setTab("fluo");
    });

    this.tabButtons.melting = this.makeButton(this.scale.width / 2 + 8, 18, 120, 28, "Melting", () => {
      this.setTab("melting");
    });

    this.paintTabButtons();
  }

  makeButton(x, y, w, h, label, onClick) {
    const g = this.add.graphics();
    const t = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: "Avenir Next, Segoe UI, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#e7f4ff"
    }).setOrigin(0.5);

    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", onClick);

    const redraw = (active) => {
      g.clear();
      g.fillStyle(active ? 0x1f6db2 : 0x1d2432, 1);
      g.fillRoundedRect(x, y, w, h, 8);
      g.lineStyle(1, active ? 0x7dd5ff : 0xffffff, active ? 0.45 : 0.2);
      g.strokeRoundedRect(x, y, w, h, 8);
    };

    redraw(false);
    return { x, y, w, h, label, redraw, g, t, hit };
  }

  paintTabButtons() {
    this.tabButtons.fluo.redraw(this.state.tab === "fluo");
    this.tabButtons.melting.redraw(this.state.tab === "melting");
  }

  bindDom() {
    this.dom = {
      csvInput: document.getElementById("csv-file"),
      chartShell: document.getElementById("chart-shell"),
      left: document.getElementById("left-panel-content"),
      right: document.getElementById("right-panel-content"),
      sampleList: document.getElementById("sample-list"),
      palette: document.getElementById("palette-select"),
      applyPalette: document.getElementById("apply-palette"),
      normalizeMode: document.getElementById("normalize-mode"),
      tempChannel: document.getElementById("temp-channel"),
      rangeStart: document.getElementById("range-start"),
      rangeEnd: document.getElementById("range-end"),
      rangeStartLabel: document.getElementById("range-start-label"),
      rangeEndLabel: document.getElementById("range-end-label"),
      startValue: document.getElementById("start-value"),
      endValue: document.getElementById("end-value"),
      smooth: document.getElementById("smooth-window"),
      smoothLabel: document.getElementById("smooth-window-label"),
      exportBtn: document.getElementById("export-current"),
      downloadJpegBtn: document.getElementById("download-jpeg"),
      thresholdValue: document.getElementById("threshold-value"),
      thresholdHelp: document.getElementById("threshold-help"),
      crossingsBody: document.getElementById("crossings-body"),
      status: document.getElementById("status-line")
    };

    this.dom.csvInput.addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      this.loadCsv(file);
    });

    this.dom.applyPalette.addEventListener("click", () => {
      this.applyPalette(this.dom.palette.value);
    });

    this.dom.normalizeMode.addEventListener("change", () => this.updateChart());
    this.dom.rangeStart.addEventListener("input", () => this.onRangeChanged());
    this.dom.rangeEnd.addEventListener("input", () => this.onRangeChanged());
    this.dom.startValue.addEventListener("input", () => this.onRangeValueChanged("start"));
    this.dom.endValue.addEventListener("input", () => this.onRangeValueChanged("end"));
    this.dom.smooth.addEventListener("input", () => this.onSmoothChanged());
    this.dom.tempChannel.addEventListener("change", () => this.updateChart());
    this.dom.exportBtn.addEventListener("click", () => this.exportCurrentTabCsv());
    this.dom.downloadJpegBtn.addEventListener("click", () => this.downloadCurrentChartJpeg());
    this.updateDownloadJpegButtonLabel();
  }

  updateDownloadJpegButtonLabel() {
    if (!this.dom || !this.dom.downloadJpegBtn) return;
    const tabLabel = this.state.tab === "melting" ? "Melting" : "Processed Fluo";
    this.dom.downloadJpegBtn.textContent = `Descargar ${tabLabel} JPEG`;
  }

  downloadCurrentChartJpeg() {
    if (!this.mainChart || !this.state.loaded) return;
    const chartCanvas = this.mainChart.canvas;
    if (!chartCanvas) return;

    const out = document.createElement("canvas");
    out.width = chartCanvas.width;
    out.height = chartCanvas.height;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;

    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, out.width, out.height);
    outCtx.drawImage(chartCanvas, 0, 0);

    const base = (this.state.fileName || "data").replace(/\.csv$/i, "") || "data";
    const tab = this.state.tab === "melting" ? "melting" : "processed_fluo";
    const a = document.createElement("a");
    a.href = out.toDataURL("image/jpeg", 0.95);
    a.download = `${base}_${tab}.jpeg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  getRangeIndices() {
    const n = this.state.labels.length;
    if (!n) return { start: 0, end: 0 };

    const startPct = Number(this.dom.rangeStart.value);
    const endPct = Number(this.dom.rangeEnd.value);
    const start = clamp(Math.round((startPct / 100) * (n - 1)), 0, n - 1);
    const end = clamp(Math.round((endPct / 100) * (n - 1)), start + 1, n - 1);
    return { start, end };
  }

  syncRangeValueInputs() {
    const n = this.state.labels.length;
    const { start, end } = this.getRangeIndices();

    this.dom.startValue.min = "1";
    this.dom.startValue.max = String(Math.max(1, n - 1));
    this.dom.endValue.min = "2";
    this.dom.endValue.max = String(Math.max(2, n));
    this.dom.startValue.value = String(start + 1);
    this.dom.endValue.value = String(end + 1);
  }

  onRangeValueChanged(which) {
    if (!this.state.loaded) return;

    const n = this.state.labels.length;
    let start = clamp(Number(this.dom.startValue.value || 1), 1, Math.max(1, n - 1));
    let end = clamp(Number(this.dom.endValue.value || n), 2, n);

    if (start >= end) {
      if (which === "start") {
        start = end - 1;
      } else {
        end = start + 1;
      }
    }

    this.dom.startValue.value = String(start);
    this.dom.endValue.value = String(end);

    const startPct = Math.round(((start - 1) / Math.max(1, n - 1)) * 100);
    const endPct = Math.round(((end - 1) / Math.max(1, n - 1)) * 100);

    this.dom.rangeStart.value = String(clamp(startPct, 0, 99));
    this.dom.rangeEnd.value = String(clamp(endPct, 1, 100));

    this.dom.rangeStartLabel.textContent = `${this.dom.rangeStart.value}%`;
    this.dom.rangeEndLabel.textContent = `${this.dom.rangeEnd.value}%`;
    this.updateChart();
  }

  onRangeChanged() {
    let start = Number(this.dom.rangeStart.value);
    let end = Number(this.dom.rangeEnd.value);

    if (start >= end) {
      end = clamp(start + 1, 1, 100);
      this.dom.rangeEnd.value = String(end);
    }

    this.dom.rangeStartLabel.textContent = `${this.dom.rangeStart.value}%`;
    this.dom.rangeEndLabel.textContent = `${this.dom.rangeEnd.value}%`;
    this.syncRangeValueInputs();
    this.updateChart();
  }

  onSmoothChanged() {
    this.dom.smoothLabel.textContent = this.dom.smooth.value;
    this.updateChart();
  }

  createChart() {
    const ctx = document.getElementById("main-chart");
    const scene = this;
    this.mainChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [] },
      plugins: [
        {
          id: "ctThresholdLine",
          afterDraw(chart) {
            if (scene.state.tab !== "fluo" || !Number.isFinite(scene.ctThresholdY)) return;
            const yScale = chart.scales.y;
            if (!yScale) return;

            const y = yScale.getPixelForValue(scene.ctThresholdY);
            if (!Number.isFinite(y)) return;

            const { left, right, top, bottom } = chart.chartArea;
            if (y < top || y > bottom) return;

            const { ctx } = chart;
            ctx.save();
            ctx.setLineDash([7, 5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffb020";
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.restore();
          }
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { position: "bottom" }
        },
        scales: {
          x: { title: { display: true, text: "Time / Temperature" } },
          y: { title: { display: true, text: "Signal" } }
        }
      }
    });

    ctx.addEventListener("click", (ev) => {
      if (!this.state.loaded || this.state.tab !== "fluo") return;

      const rect = ctx.getBoundingClientRect();
      const yPixel = ev.clientY - rect.top;
      const yScale = this.mainChart.scales.y;
      if (!yScale) return;

      this.ctThresholdY = yScale.getValueForPixel(yPixel);
      this.updateThresholdCrossings();
      this.mainChart.update();
    });
  }

  updateThresholdCrossings() {
    if (!this.dom.crossingsBody || !this.dom.thresholdValue) return;

    this.dom.crossingsBody.innerHTML = "";

    if (this.state.tab !== "fluo") {
      this.dom.thresholdValue.textContent = "Switch to Processed Fluo to set threshold";
      this.dom.thresholdHelp.textContent = "CT threshold works on the Processed Fluo tab.";
      return;
    }

    if (!Number.isFinite(this.ctThresholdY)) {
      this.dom.thresholdValue.textContent = "Not set";
      this.dom.thresholdHelp.textContent = "Click on a point/height in CT chart to set threshold.";
      return;
    }

    this.dom.thresholdValue.textContent = `Threshold: ${this.ctThresholdY.toFixed(4)}`;
    this.dom.thresholdHelp.textContent = "First crossing above threshold for each curve.";

    const labels = this.mainChart.data.labels || [];
    const datasets = this.mainChart.data.datasets || [];

    datasets.forEach((ds) => {
      let crossing = "never";
      for (let i = 0; i < ds.data.length; i += 1) {
        const v = ds.data[i];
        if (Number.isFinite(v) && v > this.ctThresholdY) {
          crossing = String(labels[i] ?? "");
          break;
        }
      }

      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      const tdCross = document.createElement("td");
      tdName.textContent = ds.label || "Sample";
      tdCross.textContent = crossing;
      tr.appendChild(tdName);
      tr.appendChild(tdCross);
      this.dom.crossingsBody.appendChild(tr);
    });
  }

  setStatus(text, isError = false) {
    this.dom.status.textContent = text;
    this.dom.status.classList.toggle("error", !!isError);
  }

  loadCsv(file) {
    this.setStatus(`Reading ${file.name} ...`);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          this.parseProcessedFluo(results, file.name);
          this.setStatus(`Loaded ${file.name} (${this.state.labels.length} rows).`);
          this.updateChart();
        } catch (err) {
          this.setStatus(`Error: ${err.message}`, true);
        }
      },
      error: (err) => {
        this.setStatus(`CSV parse error: ${err.message}`, true);
      }
    });
  }

  parseProcessedFluo(results, fileName) {
    const fields = results.meta && results.meta.fields ? results.meta.fields : [];
    if (fields.length < 7) {
      throw new Error("Unexpected CSV format. Need Time + fluo + 5 temperature columns.");
    }

    const timeKey = fields[0];
    const tempKeys = fields.slice(-5);
    const fluoKeys = fields.slice(1, -5).slice(0, 8);

    if (fluoKeys.length < 1) {
      throw new Error("No fluorescence channels found.");
    }

    const labels = [];
    const fluoSeries = fluoKeys.map(() => []);
    const tempSeries = tempKeys.map(() => []);

    for (const row of results.data) {
      const time = String(row[timeKey] || "").trim();
      if (!time) continue;

      labels.push(time);

      for (let i = 0; i < fluoKeys.length; i += 1) {
        fluoSeries[i].push(this.toNumber(row[fluoKeys[i]]));
      }

      for (let i = 0; i < tempKeys.length; i += 1) {
        tempSeries[i].push(this.toNumber(row[tempKeys[i]]));
      }
    }

    if (labels.length < 3) {
      throw new Error("Need at least 3 rows for melting derivative.");
    }

    this.state.loaded = true;
    this.state.fileName = fileName;
    this.state.labels = labels;
    this.state.fluoKeys = fluoKeys;
    this.state.tempKeys = tempKeys;
    this.state.fluoSeries = fluoSeries;
    this.state.tempSeries = tempSeries;

    this.state.samples = fluoKeys.map((key, idx) => ({
      key,
      name: key,
      color: PALETTES.macos[idx % PALETTES.macos.length]
    }));

    this.buildSampleEditor();
    this.populateTempChannel();
    this.applyPalette(this.dom.palette.value);
    this.syncRangeValueInputs();
  }

  toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(String(value).replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }

  buildSampleEditor() {
    this.dom.sampleList.innerHTML = "";

    this.state.samples.forEach((sample, idx) => {
      const row = document.createElement("div");
      row.className = "sample-row";

      const id = document.createElement("div");
      id.className = "tube-id";
      id.textContent = String(idx + 1);
      id.style.background = sample.color;

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = sample.name;
      nameInput.addEventListener("input", () => {
        sample.name = nameInput.value.trim() || sample.key;
        this.updateChart();
      });

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = sample.color;
      colorInput.addEventListener("input", () => {
        sample.color = colorInput.value;
        id.style.background = sample.color;
        this.updateChart();
      });

      row.appendChild(id);
      row.appendChild(nameInput);
      row.appendChild(colorInput);
      this.dom.sampleList.appendChild(row);
    });
  }

  populateTempChannel() {
    this.dom.tempChannel.innerHTML = "";
    this.state.tempKeys.forEach((key, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = key;
      this.dom.tempChannel.appendChild(opt);
    });

    const targetIdx = Math.max(0, this.state.tempKeys.findIndex((k) => /target/i.test(k)));
    this.dom.tempChannel.value = String(targetIdx);
  }

  applyPalette(name) {
    const palette = PALETTES[name] || PALETTES.macos;

    this.state.samples.forEach((sample, idx) => {
      sample.color = palette[idx % palette.length];
    });

    this.buildSampleEditor();
    this.updateChart();
  }

  setTab(tabName) {
    this.state.tab = tabName;
    this.paintTabButtons();
    this.updateDownloadJpegButtonLabel();
    this.updateChart();
  }

  buildDatasetsFluo() {
    return this.state.samples.map((sample, idx) => ({
      label: sample.name,
      data: this.state.fluoSeries[idx],
      borderColor: sample.color,
      backgroundColor: sample.color,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: true
    }));
  }

  movingAverage(arr, windowSize) {
    if (windowSize <= 1) return arr.slice();
    const out = [];
    const half = Math.floor(windowSize / 2);

    for (let i = 0; i < arr.length; i += 1) {
      let sum = 0;
      let count = 0;
      for (let j = i - half; j <= i + half; j += 1) {
        if (j < 0 || j >= arr.length) continue;
        const v = arr[j];
        if (v === null || !Number.isFinite(v)) continue;
        sum += v;
        count += 1;
      }
      out.push(count > 0 ? sum / count : null);
    }

    return out;
  }

  seriesVariance(series, start, end) {
    const vals = [];
    for (let i = start; i <= end; i += 1) {
      const v = series[i];
      if (Number.isFinite(v)) vals.push(v);
    }
    if (vals.length < 2) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const varSum = vals.reduce((acc, v) => acc + (v - mean) * (v - mean), 0);
    return varSum / (vals.length - 1);
  }

  getBestTempSeries(start, end) {
    const selectedIdx = Number(this.dom.tempChannel.value || 0);
    const selected = this.state.tempSeries[selectedIdx] || [];
    const selectedVar = this.seriesVariance(selected, start, end);

    // If selected channel is almost constant, pick the temp channel with highest variance.
    if (selectedVar > 1e-6) {
      return selected;
    }

    let bestIdx = selectedIdx;
    let bestVar = selectedVar;
    for (let i = 0; i < this.state.tempSeries.length; i += 1) {
      const v = this.seriesVariance(this.state.tempSeries[i], start, end);
      if (v > bestVar) {
        bestVar = v;
        bestIdx = i;
      }
    }
    return this.state.tempSeries[bestIdx] || selected;
  }

  normalizeSeries(series, mode, baseStart, baseEnd) {
    const clean = series.map((v) => (Number.isFinite(v) ? v : null));
    if (mode === "raw") {
      return clean;
    }

    const base = Number.isFinite(clean[baseStart]) ? clean[baseStart] : clean.find((v) => Number.isFinite(v));
    const finiteVals = clean.filter((v) => Number.isFinite(v));
    const minVal = finiteVals.length ? Math.min(...finiteVals) : null;
    const maxVal = finiteVals.length ? Math.max(...finiteVals) : null;

    return clean.map((v) => {
      if (!Number.isFinite(v)) return null;
      if (mode === "subtract") {
        return Number.isFinite(base) ? v - base : null;
      }
      if (mode === "division") {
        return Number.isFinite(base) && Math.abs(base) > 1e-12 ? v / base : null;
      }
      if (mode === "minmax") {
        if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || maxVal === minVal) return null;
        return ((v - minVal) / (maxVal - minVal)) * 100;
      }
      return v;
    });
  }

  buildMelting() {
    const mode = this.dom.normalizeMode.value;
    const smooth = Number(this.dom.smooth.value);
    const tempIdx = Number(this.dom.tempChannel.value || 0);

    const selectedTemp = this.state.tempSeries[tempIdx] || [];
    const range = this.getRangeIndices();
    const start = clamp(range.start, 1, selectedTemp.length - 2);
    const end = clamp(range.end, start + 1, selectedTemp.length - 2);
    const temp = this.getBestTempSeries(start, end);
    const tempSmoothed = this.movingAverage(temp, Math.max(1, smooth));

    const labels = [];
    for (let j = start; j <= end; j += 1) {
      const t = tempSmoothed[j];
      labels.push(Number.isFinite(t) ? Number(t).toFixed(2) : "");
    }

    const datasets = this.state.samples.map((sample, sampleIdx) => {
      const rawFluo = this.state.fluoSeries[sampleIdx] || [];
      let fluo = this.normalizeSeries(rawFluo, mode, start, end);
      // Fallback to raw if the selected normalization creates too many invalid points.
      const validNorm = fluo.filter((v) => Number.isFinite(v)).length;
      if (validNorm < 3 && mode !== "raw") {
        fluo = this.normalizeSeries(rawFluo, "raw", start, end);
      }

      const fluoSmoothed = this.movingAverage(fluo, Math.max(1, smooth));
      const melt = [];

      for (let j = start; j <= end; j += 1) {
        const fPrev = fluoSmoothed[j - 1];
        const fNext = fluoSmoothed[j + 1];
        const tPrev = tempSmoothed[j - 1];
        const tNext = tempSmoothed[j + 1];

        if (![fPrev, fNext, tPrev, tNext].every(Number.isFinite)) {
          melt.push(null);
          continue;
        }

        const dF = fNext - fPrev;
        const dT = tNext - tPrev;

        if (!Number.isFinite(dT) || Math.abs(dT) < 1e-12) {
          melt.push(null);
        } else {
          melt.push(-(dF / dT));
        }
      }

      const smoothData = this.movingAverage(melt, Math.max(1, smooth));

      return {
        label: sample.name,
        data: smoothData,
        borderColor: sample.color,
        backgroundColor: sample.color,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true
      };
    });

    return { labels, datasets };
  }

  updateChart() {
    if (!this.mainChart) return;

    if (!this.state.loaded) {
      this.mainChart.data.labels = [];
      this.mainChart.data.datasets = [];
      this.mainChart.update();
      return;
    }

    if (this.state.tab === "fluo") {
      const mode = this.dom.normalizeMode.value;
      const smooth = Number(this.dom.smooth.value);
      const { start, end } = this.getRangeIndices();

      this.mainChart.options.scales.x.title.text = "Time";
      this.mainChart.options.scales.y.title.text = "Processed fluorescence";
      this.mainChart.data.labels = this.state.labels.slice(start, end + 1);
      this.mainChart.data.datasets = this.state.samples.map((sample, idx) => {
        const normalized = this.normalizeSeries(this.state.fluoSeries[idx], mode, start, end);
        const sliced = normalized.slice(start, end + 1);
        const softened = this.movingAverage(sliced, smooth);
        return {
          label: sample.name,
          data: softened,
          borderColor: sample.color,
          backgroundColor: sample.color,
          pointRadius: 0,
          borderWidth: 2,
          spanGaps: true
        };
      });
    } else {
      const melt = this.buildMelting();
      this.mainChart.options.scales.x.title.text = "Temperature (C)";
      this.mainChart.options.scales.y.title.text = "-dF/dT";
      this.mainChart.data.labels = melt.labels;
      this.mainChart.data.datasets = melt.datasets;
    }

    this.mainChart.update();
    this.updateThresholdCrossings();
  }

  exportCurrentTabCsv() {
    if (!this.state.loaded) return;

    const isMelting = this.state.tab === "melting";
    const labels = isMelting ? this.mainChart.data.labels : this.state.labels;
    const datasets = this.mainChart.data.datasets;

    const header = [isMelting ? "Temperature" : "Time", ...datasets.map((d) => d.label)].join(",");
    const rows = [header];

    for (let i = 0; i < labels.length; i += 1) {
      const row = [labels[i]];
      for (let j = 0; j < datasets.length; j += 1) {
        const v = datasets[j].data[i];
        row.push(v === null || !Number.isFinite(v) ? "" : String(v));
      }
      rows.push(row.join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = this.state.fileName.replace(/\.csv$/i, "") || "data";
    a.href = url;
    a.download = `${base}_${this.state.tab}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  onPanelToggle(side, expanded) {
    if (side === "left") {
      this.dom.left.classList.toggle("hidden", !expanded);
    } else {
      this.dom.right.classList.toggle("hidden", !expanded);
    }

    this.syncLayout();
    this.updateChart();
  }

  syncLayout() {
    this.redrawTopBar();

    const w = this.scale.width;
    const h = this.scale.height;

    this.leftPanel.setRect(16, 74, 300, h - 90);
    const rightCurrentW = this.rightPanel.getCurrentWidth();
    this.rightPanel.setRect(w - 16 - rightCurrentW, 74, 300, h - 90);

    const leftW = this.leftPanel.getCurrentWidth();
    const rightW = this.rightPanel.getCurrentWidth();

    const chartLeft = 16 + leftW + 10;
    const chartTop = 74;
    const chartRight = w - 16 - rightW - 10;
    const chartW = Math.max(320, chartRight - chartLeft);
    const chartH = Math.max(240, h - chartTop - 16);

    this.dom.chartShell.style.left = `${chartLeft}px`;
    this.dom.chartShell.style.top = `${chartTop}px`;
    this.dom.chartShell.style.width = `${chartW}px`;
    this.dom.chartShell.style.height = `${chartH}px`;

    if (this.leftPanel.expanded) {
      this.dom.left.style.left = `${this.leftPanel.x + 8}px`;
      this.dom.left.style.top = `${this.leftPanel.y + 34}px`;
      this.dom.left.style.width = `${this.leftPanel.width - 16}px`;
      this.dom.left.style.height = `${this.leftPanel.height - 42}px`;
    }

    if (this.rightPanel.expanded) {
      this.dom.right.style.left = `${this.rightPanel.x + 8}px`;
      this.dom.right.style.top = `${this.rightPanel.y + 34}px`;
      this.dom.right.style.width = `${this.rightPanel.width - 16}px`;
      this.dom.right.style.height = `${this.rightPanel.height - 42}px`;
    }

    if (this.tabButtons.fluo && this.tabButtons.melting) {
      const fx = w / 2 - 158;
      const mx = w / 2 + 8;
      this.tabButtons.fluo.x = fx;
      this.tabButtons.melting.x = mx;
      this.tabButtons.fluo.t.setPosition(fx + this.tabButtons.fluo.w / 2, 18 + this.tabButtons.fluo.h / 2);
      this.tabButtons.melting.t.setPosition(mx + this.tabButtons.melting.w / 2, 18 + this.tabButtons.melting.h / 2);
      this.tabButtons.fluo.hit.setPosition(fx + this.tabButtons.fluo.w / 2, 18 + this.tabButtons.fluo.h / 2);
      this.tabButtons.melting.hit.setPosition(mx + this.tabButtons.melting.w / 2, 18 + this.tabButtons.melting.h / 2);

      this.tabButtons.fluo.redraw = ((btn) => (active) => {
        btn.g.clear();
        btn.g.fillStyle(active ? 0x1f6db2 : 0x1d2432, 1);
        btn.g.fillRoundedRect(btn.x, 18, btn.w, btn.h, 8);
        btn.g.lineStyle(1, active ? 0x7dd5ff : 0xffffff, active ? 0.45 : 0.2);
        btn.g.strokeRoundedRect(btn.x, 18, btn.w, btn.h, 8);
      })(this.tabButtons.fluo);

      this.tabButtons.melting.redraw = ((btn) => (active) => {
        btn.g.clear();
        btn.g.fillStyle(active ? 0x1f6db2 : 0x1d2432, 1);
        btn.g.fillRoundedRect(btn.x, 18, btn.w, btn.h, 8);
        btn.g.lineStyle(1, active ? 0x7dd5ff : 0xffffff, active ? 0.45 : 0.2);
        btn.g.strokeRoundedRect(btn.x, 18, btn.w, btn.h, 8);
      })(this.tabButtons.melting);

      this.paintTabButtons();
    }
  }
}
