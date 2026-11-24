package io.github.fuzzyslipper.lorefitness.wear

import android.content.Context
import com.google.android.gms.wearable.Wearable
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import io.github.fuzzyslipper.lorefitness.core.Category
import io.github.fuzzyslipper.lorefitness.core.DataLayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * The watch's own copy: the last state the phone sent, check-ins not yet confirmed by the phone,
 * and which resolved rolls have already been shown. The watch never talks to the ledger itself.
 */
class WatchStore(context: Context) {
    private val app = context.applicationContext
    private val prefs = app.getSharedPreferences("skyhold", Context.MODE_PRIVATE)
    private val lock = Any()
    private val _state = MutableStateFlow(load())
    val state: StateFlow<WatchState> = _state

    fun saveState(json: String) {
        val edit = prefs.edit().putString("state", json)
        // The first state after install: rolls already in it are history, not rolls to show.
        if (!prefs.getBoolean("initialized", false)) {
            val rolls = JSONObject(json).optJSONArray("rolls") ?: JSONArray()
            edit.putString("seenRolls", JSONArray((0 until rolls.length()).map { rolls.getJSONObject(it).optString("id") }).toString())
            edit.putBoolean("initialized", true)
        }
        edit.commit()
        _state.value = load()
    }

    fun markRollSeen(id: String) {
        val seen = JSONArray(prefs.getString("seenRolls", "[]")).apply { put(id) }
        val trimmed = JSONArray((maxOf(0, seen.length() - 50) until seen.length()).map { seen.get(it) })
        prefs.edit().putString("seenRolls", trimmed.toString()).commit()
        _state.value = load()
    }

    /** A check-in on the wrist: kept here until the phone says the ledger has it. */
    fun checkIn(category: Category): ActivityRecord {
        val record = ActivityRecord(
            source = "lfr-watch",
            sourceRecordId = UUID.randomUUID().toString(),
            revision = 1,
            kind = category.manualKind,
            category = category.id,
            start = Instant.now().toString(),
            timeZone = ZoneId.systemDefault().id,
            quantities = if (category == Category.HYDRATION) mapOf("goalMet" to 1) else emptyMap(),
        )
        synchronized(lock) {
            val pending = JSONArray(prefs.getString("pending", "[]")).apply { put(record.toStorage()) }
            prefs.edit().putString("pending", pending.toString()).commit()
        }
        _state.value = load()
        return record
    }

    fun acknowledge(key: String) = synchronized(lock) {
        val pending = JSONArray(prefs.getString("pending", "[]"))
        val kept = JSONArray((0 until pending.length()).map { pending.getJSONObject(it) }
            .filter { ActivityRecord.fromStorage(it).key != key })
        prefs.edit().putString("pending", kept.toString()).commit()
        _state.value = load()
    }

    fun pending(): List<ActivityRecord> = synchronized(lock) {
        val pending = JSONArray(prefs.getString("pending", "[]"))
        (0 until pending.length()).map { ActivityRecord.fromStorage(pending.getJSONObject(it)) }
    }

    /** Sends every unconfirmed check-in to the phone; false when no phone is reachable. */
    suspend fun sendPending(): Boolean {
        val nodes = runCatching { Wearable.getNodeClient(app).connectedNodes.await() }.getOrDefault(emptyList())
        if (nodes.isEmpty()) return false
        val client = Wearable.getMessageClient(app)
        for (node in nodes) {
            val items = pending()
            if (items.isEmpty()) runCatching { client.sendMessage(node.id, DataLayer.SYNC_REQUEST, ByteArray(0)).await() }
            for (record in items) runCatching { client.sendMessage(node.id, DataLayer.CHECK_IN, record.toStorage().toString().toByteArray()).await() }
        }
        return true
    }

    private fun load(): WatchState {
        val state = prefs.getString("state", null)?.let { JSONObject(it) }
        val seen = JSONArray(prefs.getString("seenRolls", "[]")).let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
        val rolls = state?.optJSONArray("rolls")
        val unseen = rolls?.let { a -> (0 until a.length()).map { a.getJSONObject(it) }.firstOrNull { it.optString("id") !in seen } }
        return WatchState(state, JSONArray(prefs.getString("pending", "[]")).length(), unseen)
    }

    companion object {
        @Volatile private var instance: WatchStore? = null
        fun get(context: Context) = instance ?: synchronized(this) { instance ?: WatchStore(context).also { instance = it } }
    }
}

data class WatchState(val phoneState: JSONObject?, val pending: Int, val unseenRoll: JSONObject?)
