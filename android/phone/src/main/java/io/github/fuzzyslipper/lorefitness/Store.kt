package io.github.fuzzyslipper.lorefitness

import android.content.Context
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Everything the phone keeps on its own: settings, the queue of records the ledger has not yet
 * confirmed, and the last state it read from the ledger. SharedPreferences commits to disk, so a
 * check-in made offline survives the app being killed or the phone restarting.
 */
class Store(context: Context) {
    private val prefs = context.getSharedPreferences("lore-fitness", Context.MODE_PRIVATE)
    private val lock = Any()

    var serverUrl: String
        get() = prefs.getString("serverUrl", DEFAULT_SERVER) ?: DEFAULT_SERVER
        set(value) { prefs.edit().putString("serverUrl", value.trim()).commit() }

    /** This phone's identity in the ledger's per-client sync status. */
    val clientId: String
        get() = prefs.getString("clientId", null) ?: ("razr-" + UUID.randomUUID().toString().take(8)).also {
            prefs.edit().putString("clientId", it).commit()
        }

    /** The start of the Health Connect window read last time, in epoch millis. */
    var healthReadFrom: Long
        get() = prefs.getLong("healthReadFrom", 0)
        set(value) { prefs.edit().putLong("healthReadFrom", value).commit() }

    // ── The pending queue ──

    fun pending(): List<ActivityRecord> = synchronized(lock) { readQueue().values.toList() }

    /** Adds a record, or replaces a queued copy of it with a newer revision. */
    fun enqueue(record: ActivityRecord) = synchronized(lock) {
        val queue = readQueue()
        val existing = queue[record.key]
        if (existing == null || existing.revision <= record.revision) queue[record.key] = record
        writeQueue(queue)
        refreshPendingCount(queue.size)
    }

    /** Removes the given copies, unless a newer revision was queued meanwhile. */
    fun confirm(records: Collection<ActivityRecord>) = synchronized(lock) {
        val queue = readQueue()
        for (r in records) if ((queue[r.key]?.revision ?: Long.MAX_VALUE) <= r.revision) queue.remove(r.key)
        writeQueue(queue)
        refreshPendingCount(queue.size)
    }

    /** Records the ledger refused, kept for the player to see rather than retried forever. */
    fun reject(record: ActivityRecord, reason: String) = synchronized(lock) {
        val rejected = JSONArray(prefs.getString("rejected", "[]"))
        rejected.put(JSONObject().put("record", record.toStorage()).put("reason", reason))
        val trimmed = JSONArray((maxOf(0, rejected.length() - 20) until rejected.length()).map { rejected.get(it) })
        prefs.edit().putString("rejected", trimmed.toString()).commit()
        confirm(listOf(record))
    }

    private fun readQueue(): LinkedHashMap<String, ActivityRecord> {
        val array = JSONArray(prefs.getString("queue", "[]"))
        val map = LinkedHashMap<String, ActivityRecord>()
        for (i in 0 until array.length()) ActivityRecord.fromStorage(array.getJSONObject(i)).let { map[it.key] = it }
        return map
    }

    private fun writeQueue(queue: Map<String, ActivityRecord>) {
        prefs.edit().putString("queue", JSONArray(queue.values.map { it.toStorage() }).toString()).commit()
    }

    // ── What the screen shows ──

    private val _state = MutableStateFlow(loadState())
    val state: StateFlow<UiState> = _state

    fun saveSync(summary: JSONObject?, journal: JSONArray?, rolls: JSONArray?, error: String?, at: Long) {
        val edit = prefs.edit()
        summary?.let { edit.putString("summary", it.toString()) }
        journal?.let { edit.putString("journal", it.toString()) }
        rolls?.let { edit.putString("rolls", it.toString()) }
        edit.putString("lastError", error)
        if (error == null) edit.putLong("lastSyncAt", at)
        edit.putLong("lastAttemptAt", at)
        edit.commit()
        _state.value = loadState()
    }

    fun setHealthStatus(status: String) {
        prefs.edit().putString("healthStatus", status).commit()
        _state.value = loadState()
    }

    private fun refreshPendingCount(@Suppress("UNUSED_PARAMETER") count: Int) {
        _state.value = loadState()
    }

    private fun loadState() = UiState(
        summary = prefs.getString("summary", null)?.let { JSONObject(it) },
        journal = prefs.getString("journal", null)?.let { JSONArray(it) },
        rolls = prefs.getString("rolls", null)?.let { JSONArray(it) },
        pending = JSONArray(prefs.getString("queue", "[]")).length(),
        pendingCategories = JSONArray(prefs.getString("queue", "[]")).let { q ->
            (0 until q.length()).mapNotNull { q.getJSONObject(it).optString("category").ifEmpty { null } }.toSet()
        },
        lastSyncAt = prefs.getLong("lastSyncAt", 0),
        lastError = prefs.getString("lastError", null),
        healthStatus = prefs.getString("healthStatus", "not checked yet") ?: "",
    )

    companion object {
        const val DEFAULT_SERVER = "http://192.168.1.25:7900"
        @Volatile private var instance: Store? = null
        fun get(context: Context): Store = instance ?: synchronized(this) {
            instance ?: Store(context.applicationContext).also { instance = it }
        }
    }
}

data class UiState(
    val summary: JSONObject?,
    val journal: JSONArray?,
    val rolls: JSONArray?,
    val pending: Int,
    /** Categories with a check-in still in the queue, shown as waiting rather than offered again. */
    val pendingCategories: Set<String>,
    val lastSyncAt: Long,
    val lastError: String?,
    val healthStatus: String,
)
