package io.github.fuzzyslipper.lorefitness

import android.app.Application
import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import io.github.fuzzyslipper.lorefitness.core.Category
import io.github.fuzzyslipper.lorefitness.core.DataLayer
import io.github.fuzzyslipper.lorefitness.core.LedgerClient
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit

class LoreFitnessApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Sync.schedulePeriodic(this)
    }
}

object Sync {
    private val mutex = Mutex()

    /** A check-in made on this phone: queued first, so it survives being offline. */
    fun manualCheckIn(context: Context, category: Category, source: String = "lfr-phone", id: String = UUID.randomUUID().toString()): ActivityRecord {
        val record = ActivityRecord(
            source = source,
            sourceRecordId = id,
            revision = 1,
            kind = category.manualKind,
            category = category.id,
            start = Instant.now().toString(),
            timeZone = ZoneId.systemDefault().id,
            quantities = if (category == Category.HYDRATION) mapOf("goalMet" to 1) else emptyMap(),
        )
        Store.get(context).enqueue(record)
        return record
    }

    /**
     * One pass: import from Health Connect, send everything queued, then refresh the summary,
     * journal and resolved rolls and hand the watch its copy. Returns the records the ledger
     * accepted, so the watch can be told which of its check-ins arrived.
     */
    suspend fun run(context: Context, importHealth: Boolean = true): List<ActivityRecord> = mutex.withLock {
        val store = Store.get(context)
        if (importHealth) {
            runCatching { HealthImport.read(context) }
                .onSuccess { (records, note) -> records.forEach(store::enqueue); store.setHealthStatus(note) }
                .onFailure { store.setHealthStatus("Health Connect read failed: ${it.message}") }
        }
        val client = LedgerClient(store.serverUrl)
        val accepted = mutableListOf<ActivityRecord>()
        val now = System.currentTimeMillis()
        try {
            for (batch in store.pending().chunked(100)) {
                val results = client.postActivities(store.clientId, batch)
                batch.zip(results).forEach { (record, result) ->
                    if (result.accepted) accepted += record else store.reject(record, result.reason ?: "rejected")
                }
                store.confirm(accepted)
            }
            val summary = client.summary()
            val journal = client.journal(40)
            val rolls = client.bonusRolls("resolved")
            store.saveSync(summary, journal, rolls, null, now)
        } catch (e: Exception) {
            store.saveSync(null, null, null, e.message ?: e.toString(), now)
        }
        runCatching { pushToWatch(context, store) }
        accepted
    }

    /** The watch's copy: today's character and categories, and the latest resolved bonus rolls. */
    private suspend fun pushToWatch(context: Context, store: Store) {
        val s = store.state.value
        val compact = JSONObject()
        s.summary?.let { summary ->
            compact.put("today", summary.optString("today"))
            compact.put("character", summary.optJSONObject("character"))
            val categories = summary.optJSONObject("day")?.optJSONArray("categories") ?: JSONArray()
            compact.put("categories", JSONArray((0 until categories.length()).map { i ->
                val c = categories.getJSONObject(i)
                JSONObject().put("category", c.optString("category")).put("label", c.optString("label")).put("earned", c.optBoolean("earned"))
            }))
        }
        s.rolls?.let { rolls ->
            compact.put("rolls", JSONArray((0 until minOf(rolls.length(), 10)).map { i ->
                val r = rolls.getJSONObject(i)
                JSONObject().put("id", r.optString("id")).put("result", r.optInt("result")).put("category", r.optString("category"))
                    .put("localDate", r.optString("localDate")).put("detail", r.optString("detail"))
            }))
        }
        compact.put("pending", s.pending).put("lastSyncAt", s.lastSyncAt).put("lastError", s.lastError ?: JSONObject.NULL)
        val request = PutDataMapRequest.create(DataLayer.STATE).apply {
            dataMap.putString(DataLayer.KEY_STATE, compact.toString())
            dataMap.putLong("at", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        Wearable.getDataClient(context).putDataItem(request).await()
    }

    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("sync", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** A pass as soon as the network allows, for a check-in made while offline. */
    fun requestSoon(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("sync-soon", ExistingWorkPolicy.REPLACE, request)
    }
}

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        Sync.run(applicationContext)
        // A queue still holding records is retried by the next periodic pass or a later request.
        return Result.success()
    }
}
