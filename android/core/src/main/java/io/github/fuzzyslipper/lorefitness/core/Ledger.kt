package io.github.fuzzyslipper.lorefitness.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** The six daily check-in categories of the fitness ledger (service/src/rules.ts). */
enum class Category(val id: String, val label: String, val manualKind: String) {
    MOVED("moved", "Moved", "movement"),
    STRENGTH("strength", "Strength", "strength"),
    MOBILITY("mobility", "Mobility", "mobility"),
    MEAL("meal", "Meal habit", "meal-habit"),
    HYDRATION("hydration", "Hydration goal", "hydration"),
    REST("rest", "Rest and recovery", "recovery");

    companion object {
        fun of(id: String): Category? = entries.firstOrNull { it.id == id }
    }
}

/**
 * One activity record as the ledger takes it (`POST /v1/activities`). `(source, sourceRecordId)` is
 * its identity; a higher `revision` replaces an earlier copy, the same one is a duplicate.
 */
data class ActivityRecord(
    val source: String,
    val sourceRecordId: String,
    val revision: Long,
    val kind: String,
    val start: String,
    val end: String? = null,
    val timeZone: String,
    val category: String? = null,
    val quantities: Map<String, Number> = emptyMap(),
    val note: String? = null,
    val deleted: Boolean = false,
) {
    /** The queue's key: one pending copy per record, the newest revision winning. */
    val key: String get() = "$source|$sourceRecordId"

    fun toJson(clientId: String): JSONObject = JSONObject().apply {
        put("source", source); put("sourceRecordId", sourceRecordId); put("revision", revision)
        put("clientId", clientId); put("kind", kind); put("start", start); put("timeZone", timeZone)
        end?.let { put("end", it) }; category?.let { put("category", it) }; note?.let { put("note", it) }
        if (quantities.isNotEmpty()) put("quantities", JSONObject(quantities.mapValues { it.value }))
        if (deleted) put("deleted", true)
    }

    fun toStorage(): JSONObject = toJson("").apply { remove("clientId") }

    companion object {
        fun fromStorage(o: JSONObject): ActivityRecord = ActivityRecord(
            source = o.getString("source"),
            sourceRecordId = o.getString("sourceRecordId"),
            revision = o.getLong("revision"),
            kind = o.getString("kind"),
            start = o.getString("start"),
            end = o.optString("end").ifEmpty { null },
            timeZone = o.getString("timeZone"),
            category = o.optString("category").ifEmpty { null },
            quantities = o.optJSONObject("quantities")?.let { q -> q.keys().asSequence().associateWith { q.get(it) as Number } } ?: emptyMap(),
            note = o.optString("note").ifEmpty { null },
            deleted = o.optBoolean("deleted", false),
        )
    }
}

/** The ledger's answer for one record. Every status but `rejected` means the ledger has it. */
data class RecordResult(val status: String, val reason: String?, val effects: List<String>) {
    val accepted: Boolean get() = status != "rejected"
}

class LedgerException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** A small client for the fitness ledger's HTTP API (service/README.md). */
class LedgerClient(private val baseUrl: String, private val timeoutMs: Int = 10_000) {

    suspend fun health(): Boolean = runCatching { get("/healthz").optBoolean("ok") }.getOrDefault(false)

    suspend fun summary(): JSONObject = get("/v1/summary")

    suspend fun journal(limit: Int = 30): JSONArray = get("/v1/journal?limit=$limit").getJSONArray("entries")

    suspend fun bonusRolls(status: String): JSONArray = get("/v1/bonus-rolls?status=$status").getJSONArray("bonusRolls")

    /** Activities by local date, inclusive, each with whether it counts and why not. */
    suspend fun activities(from: String, to: String): JSONArray = get("/v1/activities?from=$from&to=$to").getJSONArray("activities")

    /** Takes any record out of counting (a re-import keeps it out), or puts it back. */
    suspend fun removeActivity(id: String, reason: String) { request("POST", "/v1/activities/$id/delete", JSONObject().put("reason", reason)) }
    suspend fun restoreActivity(id: String, reason: String) { request("POST", "/v1/activities/$id/restore", JSONObject().put("reason", reason)) }

    /** Sends records; the results are in the same order. */
    suspend fun postActivities(clientId: String, records: List<ActivityRecord>): List<RecordResult> {
        val body = JSONObject().put("clientId", clientId).put("records", JSONArray(records.map { it.toJson(clientId) }))
        val answer = request("POST", "/v1/activities", body)
        val results = answer.getJSONArray("results")
        return (0 until results.length()).map { i ->
            val r = results.getJSONObject(i)
            val effects = r.optJSONArray("effects")?.let { e -> (0 until e.length()).map { e.getString(it) } } ?: emptyList()
            RecordResult(r.getString("status"), r.optString("reason").ifEmpty { null }, effects)
        }
    }

    private suspend fun get(path: String) = request("GET", path, null)

    private suspend fun request(method: String, path: String, body: JSONObject?): JSONObject = withContext(Dispatchers.IO) {
        val connection = try {
            URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            throw LedgerException("bad server address $baseUrl", e)
        }
        try {
            connection.requestMethod = method
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("content-type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = connection.responseCode
            val text = (if (code < 400) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code >= 400) throw LedgerException("ledger answered $code: ${text.take(200)}")
            JSONObject(text)
        } catch (e: LedgerException) {
            throw e
        } catch (e: Exception) {
            throw LedgerException("ledger unreachable at $baseUrl: ${e.message}", e)
        } finally {
            connection.disconnect()
        }
    }
}

/** Paths and keys shared by the phone and watch over the Wear Data Layer. */
object DataLayer {
    /** Watch → phone message: a check-in made on the watch, as an [ActivityRecord] in storage form. */
    const val CHECK_IN = "/lfr/check-in"
    /** Phone → watch message: the ledger accepted the check-in with this queue key. */
    const val CHECK_IN_ACK = "/lfr/check-in-ack"
    /** Watch → phone message: please sync now. */
    const val SYNC_REQUEST = "/lfr/sync"
    /** Phone → watch data item: today's summary and recent resolved rolls, as JSON under [KEY_STATE]. */
    const val STATE = "/lfr/state"
    const val KEY_STATE = "state"
}
