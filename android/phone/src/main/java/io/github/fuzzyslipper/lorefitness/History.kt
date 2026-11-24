package io.github.fuzzyslipper.lorefitness

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.fuzzyslipper.lorefitness.core.Category
import io.github.fuzzyslipper.lorefitness.core.LedgerClient
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/** How far back the player can log or correct; the ledger itself accepts any date. */
private const val DAYS_BACK = 6L

private fun dayLabel(date: LocalDate, today: LocalDate = LocalDate.now()): String = when (date) {
    today -> "Today"
    today.minusDays(1) -> "Yesterday"
    else -> date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()) + " " + date.dayOfMonth
}

private fun recentDays(): List<LocalDate> = (0..DAYS_BACK).map { LocalDate.now().minusDays(it) }

private fun isOwn(activity: JSONObject) = activity.optString("source").startsWith("lfr-")

private fun sourceLabel(source: String) = when {
    source == "lfr-phone" -> "logged on the phone"
    source == "lfr-watch" -> "from the watch"
    source.contains("heytap") -> "from OHealth"
    source.startsWith("hc:") -> "from Health Connect (${source.removePrefix("hc:")})"
    else -> "from $source"
}

private fun amountLabel(activity: JSONObject): String {
    val q = activity.optJSONObject("quantities") ?: return ""
    return listOfNotNull(
        q.optInt("steps").takeIf { it > 0 }?.let { "%,d steps".format(it) },
        q.optInt("durationMin").takeIf { it > 0 }?.let { "$it min" },
        q.optInt("amountMl").takeIf { it > 0 }?.let { "$it ml" },
    ).joinToString(" · ")
}

/** The last week of activities, with corrections. Reads the ledger, so it needs the connection. */
@Composable
fun HistoryScreen(store: Store, sync: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var activities by remember { mutableStateOf<List<JSONObject>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(reload) {
        val today = LocalDate.now()
        runCatching { LedgerClient(store.serverUrl).activities(today.minusDays(DAYS_BACK).toString(), today.toString()) }
            .onSuccess { a -> activities = (0 until a.length()).map { a.getJSONObject(it) }.sortedByDescending { it.optString("start") }; error = null }
            .onFailure { error = "History needs the fitness journal: ${it.message}" }
    }
    val refresh = { sync(); reload++ }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Spacer(Modifier.height(8.dp)) }
        error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (store.pending().isNotEmpty()) item {
            Text("${store.pending().size} change(s) waiting to reach the journal; they show here once sent.", style = MaterialTheme.typography.bodySmall)
        }
        val list = activities
        if (list != null && list.isEmpty()) item { Text("Nothing logged in the last week.") }
        list?.groupBy { it.optString("localDate") }?.forEach { (date, entries) ->
            item { Text(dayLabel(LocalDate.parse(date)), style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 8.dp)) }
            items(entries) { activity ->
                ActivityRow(
                    activity,
                    onEdit = { editing = activity },
                    onRemove = {
                        if (isOwn(activity)) { Sync.correctOwn(context, activity, deleted = true); refresh() }
                        else scope.launch {
                            runCatching { LedgerClient(store.serverUrl).removeActivity(activity.getString("id"), "removed on the phone") }
                                .onFailure { error = "Could not remove it: ${it.message}" }
                            refresh()
                        }
                    },
                    onRestore = {
                        if (isOwn(activity) && activity.optBoolean("deletedAtSource")) { Sync.correctOwn(context, activity, deleted = false); refresh() }
                        else scope.launch {
                            runCatching { LedgerClient(store.serverUrl).restoreActivity(activity.getString("id"), "restored on the phone") }
                                .onFailure { error = "Could not restore it: ${it.message}" }
                            refresh()
                        }
                    },
                )
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
    editing?.let { activity ->
        EditDialog(activity, onDismiss = { editing = null }) { date, minutes ->
            Sync.correctOwn(context, activity, date = date, minutes = minutes)
            editing = null
            refresh()
        }
    }
}

@Composable
private fun ActivityRow(activity: JSONObject, onEdit: () -> Unit, onRemove: () -> Unit, onRestore: () -> Unit) {
    val removed = activity.optBoolean("removedByPlayer") || activity.optBoolean("deletedAtSource")
    val category = Category.of(activity.optString("category"))?.label ?: "Not counted toward a category"
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("$category · ${activity.optString("kind")}", fontWeight = FontWeight.SemiBold)
            Text(listOf(amountLabel(activity), sourceLabel(activity.optString("source"))).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            Text(
                when {
                    removed -> "Removed; not counted"
                    activity.optBoolean("counted") -> "Counted"
                    else -> "Not counted"
                },
                style = MaterialTheme.typography.bodySmall,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                if (removed) OutlinedButton(onClick = onRestore) { Text("Restore") }
                else {
                    if (isOwn(activity)) OutlinedButton(onClick = onEdit) { Text("Edit") }
                    OutlinedButton(onClick = onRemove) { Text("Remove") }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DayChips(selected: LocalDate, onPick: (LocalDate) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        recentDays().forEach { day -> FilterChip(selected = day == selected, onClick = { onPick(day) }, label = { Text(dayLabel(day)) }) }
    }
}

@Composable
private fun EditDialog(activity: JSONObject, onDismiss: () -> Unit, onSave: (LocalDate?, Int?) -> Unit) {
    val original = LocalDate.parse(activity.optString("localDate"))
    var day by remember { mutableStateOf(original) }
    val originalMinutes = activity.optJSONObject("quantities")?.optInt("durationMin") ?: 0
    var minutes by remember { mutableStateOf(if (originalMinutes > 0) originalMinutes.toString() else "") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Correct this entry") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Day")
                DayChips(day) { day = it }
                OutlinedTextField(value = minutes, onValueChange = { minutes = it.filter(Char::isDigit).take(3) }, label = { Text("Minutes (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val newMinutes = minutes.toIntOrNull() ?: 0
                onSave(day.takeIf { it != original }, newMinutes.takeIf { it != originalMinutes })
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Logs a check-in for an earlier day this week. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LogLaterDialog(onDismiss: () -> Unit, onSave: (Category, LocalDate, Int?) -> Unit) {
    var category by remember { mutableStateOf<Category?>(null) }
    var day by remember { mutableStateOf(LocalDate.now().minusDays(1)) }
    var minutes by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log for another day") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("What")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Category.entries.forEach { c -> FilterChip(selected = c == category, onClick = { category = c }, label = { Text(c.label) }) }
                }
                Text("When")
                DayChips(day) { day = it }
                OutlinedTextField(value = minutes, onValueChange = { minutes = it.filter(Char::isDigit).take(3) }, label = { Text("Minutes (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                Text("It counts for that day if that category was not already earned there.", style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = {
            TextButton(enabled = category != null, onClick = { category?.let { onSave(it, day, minutes.toIntOrNull()) } }) { Text("Log") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
