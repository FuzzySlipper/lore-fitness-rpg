package io.github.fuzzyslipper.lorefitness.wear

import android.app.Activity
import android.view.WindowManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import io.github.fuzzyslipper.lorefitness.core.Category
import kotlinx.coroutines.delay

/**
 * Companion-framed guided drills. Each is a fixed, modest session: no drill gets harder because
 * the last one went well, and finishing early is a normal choice, logged with the minutes done.
 */
data class Drill(
    val id: String,
    val companion: String,
    val title: String,
    val category: Category,
    val kind: String,
    /** Each step: seconds, the cue shown, and whether it is work (stronger buzz) or rest. */
    val steps: List<Step>,
    val opening: String,
    val closing: String,
) {
    data class Step(val seconds: Int, val cue: String, val work: Boolean)
    val totalSeconds get() = steps.sumOf { it.seconds }
}

val DRILLS = listOf(
    Drill(
        id = "cullen", companion = "Cullen", title = "Cullen's drill", category = Category.STRENGTH, kind = "bodyweight",
        steps = (1..10).flatMap { listOf(Drill.Step(40, "Round $it: work", true), Drill.Step(20, "Breathe", false)) },
        opening = "Form first. Speed is for people who enjoy the infirmary.",
        closing = "Good. The recruits saw that. Rest now; that's an order.",
    ),
    Drill(
        id = "bull", companion = "Iron Bull", title = "Bull's conditioning", category = Category.MOVED, kind = "movement",
        steps = (1..5).map { Drill.Step(180, if (it == 1) "Get moving" else "Keep it rolling", true) },
        opening = "Walk, jog, dance, whatever. Just keep the legs honest.",
        closing = "Ha! The Chargers owe me a drink. You earned one too.",
    ),
    Drill(
        id = "cassandra", companion = "Cassandra", title = "Cassandra's discipline", category = Category.MOBILITY, kind = "stretch",
        steps = (1..8).map { Drill.Step(60, "Hold $it of 8", true) },
        opening = "Slow and steady. A blade is only as good as the arm that can reach.",
        closing = "That was well done. Truly. Do not let Varric hear me say so.",
    ),
)

@Composable
fun DrillList(onPick: (Drill) -> Unit, onBack: () -> Unit) {
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("Training yard", fontWeight = FontWeight.Bold) }
        DRILLS.forEach { drill ->
            item {
                Chip(
                    onClick = { onPick(drill) },
                    label = { Text(drill.title) },
                    secondaryLabel = { Text("${drill.totalSeconds / 60} min · ${drill.category.label}") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
        }
        item { CompactChip(onClick = onBack, label = { Text("Back") }) }
    }
}

/** Runs a drill: cues with haptics, pause and resume, and a finish that logs the minutes done. */
@Composable
fun DrillRun(drill: Drill, onDone: (minutes: Int) -> Unit) {
    val context = LocalContext.current
    var stepIndex by remember { mutableIntStateOf(0) }
    var left by remember { mutableIntStateOf(drill.steps.first().seconds) }
    var elapsed by remember { mutableIntStateOf(0) }
    var paused by remember { mutableStateOf(true) }
    var started by remember { mutableStateOf(false) }
    var finished by remember { mutableStateOf(false) }
    // The screen stays on while a drill runs, so the cues are readable at a glance.
    DisposableEffect(Unit) {
        val window = (context as? Activity)?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    LaunchedEffect(paused, finished) {
        while (!paused && !finished) {
            delay(1000)
            elapsed += 1
            left -= 1
            if (left in 1..3) buzz(context, 25)
            if (left <= 0) {
                if (stepIndex + 1 >= drill.steps.size) {
                    finished = true
                    buzz(context, 400)
                } else {
                    stepIndex += 1
                    left = drill.steps[stepIndex].seconds
                    buzz(context, if (drill.steps[stepIndex].work) 200 else 80)
                }
            }
        }
    }
    val step = drill.steps[stepIndex]
    Box(Modifier.fillMaxSize().padding(14.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(drill.companion, color = Color(0xFFD4A64A), fontWeight = FontWeight.Bold)
            when {
                finished -> {
                    Text(drill.closing, textAlign = TextAlign.Center, style = MaterialTheme.typography.caption2)
                    Button(onClick = { onDone(maxOf(1, elapsed / 60)) }) { Text("Log") }
                }
                !started -> {
                    Text(drill.opening, textAlign = TextAlign.Center, style = MaterialTheme.typography.caption2)
                    Button(onClick = { started = true; paused = false; buzz(context, 200) }) { Text("Start") }
                }
                else -> {
                    Text(step.cue, style = MaterialTheme.typography.caption1)
                    Text("%d:%02d".format(left / 60, left % 60), fontSize = 34.sp, fontWeight = FontWeight.Bold)
                    Text("${elapsed / 60} min done", style = MaterialTheme.typography.caption3)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        CompactChip(onClick = { paused = !paused }, label = { Text(if (paused) "Resume" else "Pause") })
                        CompactChip(onClick = { finished = true; paused = true }, label = { Text("Finish") })
                    }
                }
            }
        }
    }
}
