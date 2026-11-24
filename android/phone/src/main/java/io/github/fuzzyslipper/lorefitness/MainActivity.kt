package io.github.fuzzyslipper.lorefitness

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import io.github.fuzzyslipper.lorefitness.core.Category
import io.github.fuzzyslipper.lorefitness.core.LedgerClient
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

private val Gold = Color(0xFFD4A64A)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Gold, secondary = Gold)) { App() }
        }
    }
}

private enum class Tab(val label: String) { TODAY("Today"), JOURNAL("Journal"), SETTINGS("Settings") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App() {
    val context = LocalContext.current
    val store = remember { Store.get(context) }
    val state by store.state.collectAsState()
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(Tab.TODAY) }
    var syncing by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val sync: () -> Unit = {
        if (!syncing) scope.launch { syncing = true; Sync.run(context); syncing = false }
    }
    val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        sync()
    }
    val logged: (io.github.fuzzyslipper.lorefitness.core.ActivityRecord, String) -> Unit = { record, label ->
        scope.launch {
            val result = snackbar.showSnackbar("Logged $label", actionLabel = "Undo", withDismissAction = true)
            if (result == SnackbarResult.ActionPerformed) { Sync.undo(context, record); sync() }
        }
    }
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { TopAppBar(title = { Text("Inquisition Training") }) },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { t ->
                    NavigationBarItem(selected = tab == t, onClick = { tab = t }, icon = {}, label = { Text(t.label) })
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                Tab.TODAY -> TodayScreen(state, syncing, sync, logged)
                Tab.JOURNAL -> JournalScreen(state)
                Tab.SETTINGS -> SettingsScreen(store)
            }
        }
    }
}

@Composable
private fun TodayScreen(
    state: UiState,
    syncing: Boolean,
    sync: () -> Unit,
    logged: (io.github.fuzzyslipper.lorefitness.core.ActivityRecord, String) -> Unit,
) {
    val context = LocalContext.current
    val healthLauncher = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) { sync() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Spacer(Modifier.height(4.dp)) }
        item { CharacterCard(state) }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(syncLine(state), style = MaterialTheme.typography.bodyMedium)
                    if (state.pending > 0) Text("${state.pending} waiting to reach the journal", style = MaterialTheme.typography.bodySmall)
                    state.lastError?.let { Text("Last try: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = sync, enabled = !syncing) { Text(if (syncing) "Syncing…" else "Sync now") }
                }
            }
        }
        item { Text("Today's training", style = MaterialTheme.typography.titleMedium) }
        val categories = state.summary?.optJSONObject("day")?.optJSONArray("categories")
        items(Category.entries) { category ->
            val entry = categories?.let { a -> (0 until a.length()).map { a.getJSONObject(it) }.firstOrNull { it.optString("category") == category.id } }
            val earned = entry?.optBoolean("earned") == true
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(category.label, fontWeight = FontWeight.SemiBold)
                        Text(entry?.optString("detail") ?: "not synced yet", style = MaterialTheme.typography.bodySmall)
                    }
                    when {
                        earned -> Text("✓ Earned", color = Gold)
                        category.id in state.pendingCategories -> Text("Waiting to send", style = MaterialTheme.typography.bodySmall)
                        else -> Button(onClick = {
                            val record = Sync.manualCheckIn(context, category)
                            sync()
                            logged(record, category.label)
                        }) { Text("Log") }
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("Health Connect", fontWeight = FontWeight.SemiBold)
                    Text(state.healthStatus, style = MaterialTheme.typography.bodySmall)
                    if (HealthImport.available(context)) {
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(onClick = { healthLauncher.launch(HealthImport.permissions + HealthImport.BACKGROUND) }) { Text("Connect OHealth data") }
                    }
                }
            }
        }
        item { RecentRolls(state) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun CharacterCard(state: UiState) {
    val character = state.summary?.optJSONObject("character")
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            if (character == null) {
                Text("Not synced with the fitness journal yet.")
                return@Column
            }
            val xp = character.optInt("xp")
            val next = character.optInt("nextLevelXp", 0)
            Text("Level ${character.optInt("level")}", style = MaterialTheme.typography.headlineSmall, color = Gold)
            Text(if (next > 0) "$xp / $next XP" else "$xp XP", style = MaterialTheme.typography.bodySmall)
            if (next > 0) LinearProgressIndicator(progress = { (xp.toFloat() / next).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp))
            val resources = character.optJSONObject("resources")
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Stat("Supplies", resources?.optInt("supplies") ?: 0)
                Stat("Training", resources?.optInt("training") ?: 0)
                Stat("Second chances", character.optInt("rerolls"))
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$value", style = MaterialTheme.typography.titleLarge)
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun RecentRolls(state: UiState) {
    val rolls = state.rolls ?: return
    if (rolls.length() == 0) return
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Bonus rolls", fontWeight = FontWeight.SemiBold)
            for (i in 0 until minOf(5, rolls.length())) {
                val r = rolls.getJSONObject(i)
                val label = Category.of(r.optString("category"))?.label ?: r.optString("category")
                Text("${r.optString("localDate")} · $label: rolled ${r.optInt("result")}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun JournalScreen(state: UiState) {
    val journal = state.journal
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (journal == null || journal.length() == 0) item { Text("Nothing in the journal yet.") }
        else items((0 until journal.length()).map { journal.getJSONObject(it) }) { entry ->
            Column {
                Text(entry.optString("localDate"), style = MaterialTheme.typography.labelSmall, color = Gold)
                Text(entry.optString("message"), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun SettingsScreen(store: Store) {
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(store.serverUrl) }
    var test by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Fitness journal server", fontWeight = FontWeight.SemiBold)
        OutlinedTextField(value = url, onValueChange = { url = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { store.serverUrl = url; test = "Saved." }) { Text("Save") }
            OutlinedButton(onClick = {
                scope.launch { test = if (LedgerClient(url).health()) "Reached the journal." else "Could not reach $url" }
            }) { Text("Test") }
        }
        if (test.isNotEmpty()) Text(test)
        Text("Ravens are quiet between", fontWeight = FontWeight.SemiBold)
        var quietStart by remember { mutableStateOf(store.quietStart.toString()) }
        var quietEnd by remember { mutableStateOf(store.quietEnd.toString()) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(value = quietStart, onValueChange = { quietStart = it.filter(Char::isDigit).take(2) }, singleLine = true, modifier = Modifier.weight(1f), label = { Text("from (hour)") })
            OutlinedTextField(value = quietEnd, onValueChange = { quietEnd = it.filter(Char::isDigit).take(2) }, singleLine = true, modifier = Modifier.weight(1f), label = { Text("until (hour)") })
            OutlinedButton(onClick = {
                quietStart.toIntOrNull()?.let { store.quietStart = it }
                quietEnd.toIntOrNull()?.let { store.quietEnd = it }
                test = if (store.quietStart == store.quietEnd) "Ravens are never held back."
                else "Quiet from ${store.quietStart}:00 until ${store.quietEnd}:00; ravens wait and arrive afterwards."
            }) { Text("Set") }
        }
        Text("This phone: ${store.clientId}", style = MaterialTheme.typography.bodySmall)
        Text("On the home network the journal is at ${Store.DEFAULT_SERVER}. Away from home, check-ins wait here and are sent when it can be reached again.", style = MaterialTheme.typography.bodySmall)
    }
}

private fun syncLine(state: UiState): String =
    if (state.lastSyncAt == 0L) "Not synced yet" else "Synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(state.lastSyncAt))
