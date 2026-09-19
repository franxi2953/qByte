const configForm = document.getElementById("config-form");
const saveButton = document.getElementById("save-btn");
const updateButton = document.getElementById("firmware-update");
const firmwareStatus = document.getElementById("firmware-status");
const themeSelect = document.getElementById("theme-select");
const qbyteLogo = document.getElementById("qbyte-logo");
const developerStatus = document.getElementById("developer-status");

const supportedThemes = new Set(["tokyo-night", "catppuccin", "nord", "sunset"]);

function applyTheme(theme) {
    const selectedTheme = supportedThemes.has(theme) ? theme : "tokyo-night";
    document.documentElement.dataset.theme = selectedTheme;
    themeSelect.value = selectedTheme;

    if (typeof window.refreshChartTheme === "function") window.refreshChartTheme();
    if (typeof window.redrawTubes === "function") window.redrawTubes();
}

window.applyTheme = applyTheme;

async function responseText(response) {
    const message = await response.text();
    if (!response.ok) {
        const isHtml = (response.headers.get("content-type") || "").includes("text/html");
        const detail = isHtml ? "" : message.trim().slice(0, 120);
        throw new Error(detail || `Request failed (${response.status})`);
    }
    return message;
}

async function fetchDeviceConfig() {
    try {
        const response = await fetch("/device-config", { cache: "no-store" });
        if (!response.ok) throw new Error("Device settings are unavailable.");
        const config = await response.json();
        document.getElementById("device-ip").value = config.ip || "";
        document.getElementById("device-mdns").value = config.mdns || "";
        document.getElementById("device-ssid").value = config.ssid || "";
        applyTheme(config.theme);
    } catch (error) {
        firmwareStatus.textContent = error.message;
    }
}

themeSelect.addEventListener("change", async () => {
    const theme = themeSelect.value;
    applyTheme(theme);

    try {
        const response = await fetch(`/device-config?theme=${encodeURIComponent(theme)}`);
        await responseText(response);
        firmwareStatus.textContent = "Theme saved";
    } catch (error) {
        firmwareStatus.textContent = error.message;
    }
});

let logoClickCount = 0;
let lastLogoClick = 0;

qbyteLogo.addEventListener("click", () => {
    const now = Date.now();
    logoClickCount = now - lastLogoClick <= 1500 ? logoClickCount + 1 : 1;
    lastLogoClick = now;

    if (logoClickCount < 10) return;

    logoClickCount = 0;
    document.body.classList.add("developer-mode");
    developerStatus.textContent = "Developer mode";
    if (window.UIkit && typeof window.UIkit.update === "function") {
        window.UIkit.update(document.body);
    }
});

async function fetchFirmwareStatus() {
    try {
        const response = await fetch("/firmware-update");
        if (!response.ok) throw new Error("Firmware status is unavailable.");
        const status = await response.json();
        document.getElementById("firmware-version").textContent = `Firmware ${status.version}`;
        updateButton.disabled = status.updating || status.experiment_running;
        if (status.updating) firmwareStatus.textContent = "Update in progress";
        else if (status.experiment_running) firmwareStatus.textContent = "Stop the experiment before updating";
    } catch (error) {
        updateButton.disabled = true;
        firmwareStatus.textContent = error.message;
    }
}

configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    firmwareStatus.textContent = "Saving settings";

    const params = new URLSearchParams({
        save: "1",
        mdns: document.getElementById("device-mdns").value,
        ssid: document.getElementById("device-ssid").value,
        password: document.getElementById("device-password").value
    });

    try {
        const response = await fetch(`/device-config?${params.toString()}`);
        await responseText(response);
        saveButton.classList.add("blink-green");
        firmwareStatus.textContent = "Saved; device restarting";
    } catch (error) {
        firmwareStatus.textContent = error.message;
        saveButton.disabled = false;
    }
});

updateButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
        "Update qByte firmware and interface now? Keep the device powered on until it restarts."
    );
    if (!confirmed) return;

    updateButton.disabled = true;
    firmwareStatus.textContent = "Starting update";
    try {
        const response = await fetch("/firmware-update?start=1");
        firmwareStatus.textContent = await responseText(response);
    } catch (error) {
        firmwareStatus.textContent = error.message;
        updateButton.disabled = false;
    }
});

window.addEventListener("DOMContentLoaded", () => {
    fetchDeviceConfig();
    fetchFirmwareStatus();
});
