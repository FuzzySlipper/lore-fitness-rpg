package io.github.fuzzyslipper.lorefitness.wear

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import io.github.fuzzyslipper.lorefitness.core.Category
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import kotlin.math.sqrt

private val Gold = Color(0xFFD4A64A)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { Skyhold() } }
    }
}

@Composable
private fun Skyhold() {
    val context = LocalContext.current
    val store = remember { WatchStore.get(context) }
    val state by store.state.collectAsState()
    val scope = rememberCoroutineScope()
    var phoneReachable by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { store.loadFromDataLayer(); phoneReachable = store.sendPending() }
    var screen by remember { mutableStateOf("home") }
    var drill by remember { mutableStateOf<Drill?>(null) }
    val roll = state.unseenRoll
    if (roll != null && screen == "home") {
        RollScreen(roll) { store.markRollSeen(roll.optString("id")) }
        return
    }
    when (screen) {
        "drills" -> { DrillList(onPick = { drill = it; screen = "run" }, onBack = { screen = "home" }); return }
        "run" -> drill?.let { d ->
            DrillRun(d) { minutes ->
                store.drillDone(d, minutes)
                scope.launch { phoneReachable = store.sendPending() }
                screen = "home"
            }
            return
        }
    }
    val phone = state.phoneState
    val character = phone?.optJSONObject("character")
    val categories = phone?.optJSONArray("categories")
    val earned = categories?.let { a -> (0 until a.length()).count { a.getJSONObject(it).optBoolean("earned") } } ?: 0
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Skyhold", color = Gold, fontWeight = FontWeight.Bold) }
        item {
            Text(
                if (character == null) "Waiting for the phone" else "Level ${character.optInt("level")} · ${character.optInt("xp")} XP",
                textAlign = TextAlign.Center,
            )
        }
        item { Text("Readiness $earned of 6 today", style = MaterialTheme.typography.caption2) }
        item {
            Chip(
                onClick = { store.checkIn(Category.HYDRATION); scope.launch { phoneReachable = store.sendPending() }; buzz(context, 40) },
                label = { Text("Water goal met") },
                colors = ChipDefaults.primaryChipColors(backgroundColor = Color(0xFF2B5D8A)),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { store.checkIn(Category.REST); scope.launch { phoneReachable = store.sendPending() }; buzz(context, 40) },
                label = { Text("Recovery") },
                colors = ChipDefaults.primaryChipColors(backgroundColor = Color(0xFF4E6B3A)),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { screen = "drills" },
                label = { Text("Training yard") },
                secondaryLabel = { Text("Guided drills") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (state.pending > 0) item {
            Text(
                "${state.pending} waiting for the phone" + if (!phoneReachable) " (not in reach)" else "",
                style = MaterialTheme.typography.caption2,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * Shake to roll. The number shown at the end is the roll the ledger stored (rolled by Marinara's
 * dice); the spinning faces before it are only the animation, and nothing here rolls a die.
 */
@Composable
private fun RollScreen(roll: JSONObject, done: () -> Unit) {
    val context = LocalContext.current
    val result = roll.optInt("result")
    val label = Category.of(roll.optString("category"))?.label ?: "Training"
    var phase by remember { mutableIntStateOf(0) } // 0 waiting for a flick, 1 rolling, 2 shown
    var face by remember { mutableIntStateOf(20) }
    ShakeDetector(enabled = phase == 0) { phase = 1 }
    LaunchedEffect(phase) {
        if (phase != 1) return@LaunchedEffect
        val faces = listOf(7, 14, 3, 19, 11, 5, 16, 9, 2, 13, 18, 6)
        for ((i, f) in faces.withIndex()) { face = f; buzz(context, 15); delay(60L + i * 18L) }
        face = result
        buzz(context, if (result >= 18) 300 else 120)
        phase = 2
    }
    Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("$label bonus roll", style = MaterialTheme.typography.caption1, textAlign = TextAlign.Center)
            Text(if (phase == 0) "d20" else "$face", fontSize = 44.sp, color = Gold, fontWeight = FontWeight.Bold)
            when (phase) {
                0 -> {
                    Text("Flick your wrist to roll", style = MaterialTheme.typography.caption2)
                    Button(onClick = { phase = 1 }) { Text("Roll") }
                }
                1 -> Text("…", style = MaterialTheme.typography.caption2)
                else -> {
                    Text(if (result >= 18) "A lucky find!" else "Logged in the journal", style = MaterialTheme.typography.caption2)
                    Button(onClick = done) { Text("OK") }
                }
            }
        }
    }
}

@Composable
private fun ShakeDetector(enabled: Boolean, onShake: () -> Unit) {
    val context = LocalContext.current
    DisposableEffect(enabled) {
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = manager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION) ?: manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val gravity = if (sensor?.type == Sensor.TYPE_ACCELEROMETER) SensorManager.GRAVITY_EARTH else 0f
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                val (x, y, z) = event.values
                if (sqrt(x * x + y * y + z * z) - gravity > 14f) onShake()
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        if (enabled && sensor != null) manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { manager.unregisterListener(listener) }
    }
}

internal fun buzz(context: Context, ms: Long) {
    val vibrator = context.getSystemService(Vibrator::class.java) ?: return
    vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
}
