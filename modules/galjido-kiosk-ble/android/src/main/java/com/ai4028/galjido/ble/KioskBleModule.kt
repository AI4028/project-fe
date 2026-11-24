package com.ai4028.galjido.ble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.location.LocationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KioskBleModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var active: KioskScan? = null

  override fun definition() = ModuleDefinition {
    Name("GaljidoKioskBle")

    AsyncFunction("scan") { id: Int, promise: Promise -> start(id, promise) }
      .runOnQueue(Queues.MAIN)
    AsyncFunction("cancelScan") { id: Int ->
      active?.takeIf { it.id == id }?.finish("cancelled")
      Unit
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground { main.post { active?.finish("cancelled") } }
    OnDestroy { main.post { active?.finish("cancelled") } }
  }

  @SuppressLint("MissingPermission")
  private fun start(id: Int, promise: Promise) {
    fun fail(status: String) = promise.resolve(mapOf("status" to status))
    val context = appContext.reactContext ?: return fail("unavailable")
    if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {
      return fail("unavailable")
    }

    val legacy = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
    val permission = if (legacy) Manifest.permission.ACCESS_FINE_LOCATION else Manifest.permission.BLUETOOTH_SCAN
    if (context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
      return fail("permission-denied")
    }
    val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
      ?: return fail("unavailable")
    val scanner = try {
      adapter.bluetoothLeScanner ?: return fail("bluetooth-off")
    } catch (_: SecurityException) {
      return fail("permission-denied")
    }
    if (legacy && context.getSystemService(LocationManager::class.java)?.let {
        LocationManagerCompat.isLocationEnabled(it)
      } != true) {
      return fail("location-off")
    }

    active?.finish("cancelled")
    val scan = KioskScan(id, scanner, promise)
    active = scan
    scan.start()
  }

  @SuppressLint("MissingPermission")
  private inner class KioskScan(val id: Int, val scanner: BluetoothLeScanner, val promise: Promise) {
    private val readings = linkedMapOf<String, ScanResult>()
    private val timeout = Runnable { finish("complete") }
    private val callback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        main.post { record(result) }
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        main.post { results.forEach(::record) }
      }

      override fun onScanFailed(errorCode: Int) {
        main.post { finish("scan-failed") }
      }
    }

    fun start() {
      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .build()
      try {
        scanner.startScan(null, settings, callback)
        main.postDelayed(timeout, SCAN_DURATION_MS)
      } catch (_: SecurityException) {
        finish("permission-denied")
      } catch (_: IllegalStateException) {
        finish("bluetooth-off")
      }
    }

    private fun record(result: ScanResult) {
      if (active !== this) return
      val name = result.scanRecord?.deviceName ?: return
      if (!KIOSK_NAME.matches(name)) return
      val kioskId = name.substring(2, 6)
      val previous = readings[kioskId]
      if (previous == null && readings.size >= MAX_KIOSKS) return
      if (previous == null || result.timestampNanos >= previous.timestampNanos) {
        readings[kioskId] = result
      }
    }

    fun finish(status: String) {
      if (active !== this) return
      active = null
      main.removeCallbacks(timeout)
      try {
        scanner.stopScan(callback)
      } catch (_: SecurityException) {
        // Android already revoked access to the scanner.
      } catch (_: IllegalStateException) {
        // The adapter may have been turned off while scanning.
      }
      val result = if (status == "complete") {
        mapOf("status" to status, "advertisements" to readings.values.mapNotNull { it.scanRecord?.deviceName })
      } else {
        mapOf("status" to status)
      }
      promise.resolve(result)
    }
  }

  private companion object {
    const val SCAN_DURATION_MS = 6000L
    const val MAX_KIOSKS = 64
    val KIOSK_NAME = Regex("LK[A-Z0-9]{4}[0-9A-HJKMNP-TV-Z]{8}")
  }
}
