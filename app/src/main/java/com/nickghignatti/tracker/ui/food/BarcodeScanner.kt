package com.nickghignatti.tracker.ui.food

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

/**
 * Google's code scanner: it brings its own camera screen through Google Play services, so the app
 * needs no camera permission. Returns a function that starts a scan; cancelling calls neither callback.
 */
@Composable
fun rememberBarcodeScanner(onScanned: (String) -> Unit, onUnavailable: () -> Unit): () -> Unit {
    val context = LocalContext.current
    val scanned by rememberUpdatedState(onScanned)
    val unavailable by rememberUpdatedState(onUnavailable)
    val client = remember(context) {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
            .enableAutoZoom()
            .build()
        GmsBarcodeScanning.getClient(context, options)
    }
    return remember(client) {
        {
            client.startScan()
                .addOnSuccessListener { barcode -> barcode.rawValue?.let { scanned(it) } }
                .addOnFailureListener { unavailable() }
        }
    }
}
