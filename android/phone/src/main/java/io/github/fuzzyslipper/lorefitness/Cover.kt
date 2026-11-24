package io.github.fuzzyslipper.lorefitness

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import io.github.fuzzyslipper.lorefitness.core.Category

private val Gold = Color(0xFFD4A64A)

/**
 * The razr's cover screen (about 480 × 565 dp): the level, readiness and the six check-ins as big
 * tap targets, without tabs or scrolling. The full app takes over when the phone is opened.
 */
@Composable
fun CoverScreen(
    state: UiState,
    syncing: Boolean,
    sync: () -> Unit,
    snackbar: SnackbarHostState,
    logged: (ActivityRecord, String) -> Unit,
) {
    val context = LocalContext.current
    val character = state.summary?.optJSONObject("character")
    val categories = state.summary?.optJSONObject("day")?.optJSONArray("categories")
    val earned = Category.entries.associateWith { c ->
        categories?.let { a -> (0 until a.length()).map { a.getJSONObject(it) }.firstOrNull { it.optString("category") == c.id }?.optBoolean("earned") } == true
    }
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        Column(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        if (character == null) "Skyhold" else "Level ${character.optInt("level")}",
                        style = MaterialTheme.typography.titleLarge, color = Gold, fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${earned.values.count { it }} of 6 ready" + if (state.pending > 0) " · ${state.pending} waiting" else "",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                TextButton(onClick = sync, enabled = !syncing) { Text(if (syncing) "Syncing…" else "Sync") }
            }
            // Three rows of two that share the height left, so the targets are as big as the screen allows.
            Category.entries.chunked(2).forEach { pair ->
                Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    pair.forEach { category ->
                        val done = earned[category] == true
                        val waiting = category.id in state.pendingCategories
                        Button(
                            onClick = {
                                if (!done && !waiting) {
                                    val record = Sync.manualCheckIn(context, category)
                                    sync()
                                    logged(record, category.label)
                                }
                            },
                            shape = RoundedCornerShape(16.dp),
                            colors = if (done) ButtonDefaults.buttonColors(containerColor = Color(0xFF3A3420), contentColor = Gold)
                            else ButtonDefaults.buttonColors(),
                            modifier = Modifier.weight(1f).fillMaxHeight(),
                        ) {
                            Text(
                                when {
                                    done -> "✓ ${category.label}"
                                    waiting -> "${category.label}\nwaiting"
                                    else -> category.label
                                },
                                textAlign = TextAlign.Center,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
            state.lastError?.let { Text("Journal not reachable; check-ins wait here.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }
    }
}
