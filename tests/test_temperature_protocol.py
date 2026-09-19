"""Production test for the heater controls and four temperature sensors."""

import math
import os
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright


DEVICE = os.getenv("QBYTE_URL", "http://qByte.local").rstrip("/")
HEADLESS = os.getenv("QBYTE_HEADLESS", "0") == "1"
MIN_CHANGE = 0.5


def read_chart(page):
    return page.evaluate(
        """() => temp_chart.data.datasets.slice(0, 4)
            .map(dataset => dataset.data.at(-1))"""
    )


def wait_for_new_reading(page, previous_count):
    response = requests.get(f"{DEVICE}/manual_cycle", timeout=10)
    assert response.text.startswith("[OK]"), response.text
    page.wait_for_timeout(3_000)
    page.evaluate("updateData()")
    page.wait_for_function(
        "count => temp_chart.data.datasets[0].data.length > count",
        arg=previous_count,
        timeout=20_000,
    )
    return read_chart(page)


def assert_sensors_are_sane(values):
    assert len(values) == 4
    assert all(math.isfinite(value) for value in values), values
    assert all(value != -1 for value in values), values
    assert all(0 <= value <= 130 for value in values), values


def test_temperature_protocol():
    previous_lid = requests.get(f"{DEVICE}/lid_temp", timeout=5).text.strip()
    previous_diff = requests.get(f"{DEVICE}/lid_diff", timeout=5).text.strip()
    assert requests.get(f"{DEVICE}/OnGoing", timeout=5).text.strip() == "0"

    Path("tests/artifacts").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=HEADLESS, slow_mo=100)
        page = browser.new_page()
        started = False
        try:
            page.goto(DEVICE, wait_until="networkidle", timeout=30_000)
            page.get_by_role("link", name="Experiment run").click()

            page.locator("#lid-temp").fill("70")
            with page.expect_response("**/lid_temp?set=70"):
                page.locator("#lid-temp-set").click()

            page.locator("#lid-diff").fill("10")
            with page.expect_response("**/lid_diff?set=10"):
                page.locator("#lid-diff-set").click()

            page.locator("#degrees").fill("60")
            with page.expect_response("**/Run?degrees=60"):
                page.locator("#temp").click()
            started = True
            page.locator("#temp").filter(has_text="Stop").wait_for(timeout=15_000)

            first = wait_for_new_reading(page, 0)
            assert_sensors_are_sane(first)
            time.sleep(10)

            count = page.evaluate("temp_chart.data.datasets[0].data.length")
            second = wait_for_new_reading(page, count)
            assert_sensors_are_sane(second)

            changes = [end - start for start, end in zip(first, second)]
            assert any(abs(change) >= MIN_CHANGE for change in changes), changes
            assert changes[3] >= MIN_CHANGE, f"Lid did not warm up: {changes[3]:.2f} °C"
            print(f"Start: {first}")
            print(f"10 s:  {second}")
        except Exception:
            page.screenshot(path="tests/artifacts/temperature_failure.png", full_page=True)
            raise
        finally:
            try:
                if started:
                    requests.get(f"{DEVICE}/Stop", timeout=5)
                requests.get(f"{DEVICE}/lid_temp?set={previous_lid}", timeout=5)
                requests.get(f"{DEVICE}/lid_diff?set={previous_diff}", timeout=5)
            finally:
                browser.close()
