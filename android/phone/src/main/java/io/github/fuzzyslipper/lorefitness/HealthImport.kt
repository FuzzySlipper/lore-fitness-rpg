package io.github.fuzzyslipper.lorefitness

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import kotlin.reflect.KClass

/**
 * Reads what other apps (OHealth on Lore's phone) wrote to Health Connect and turns it into ledger
 * records. Each record keeps its Health Connect identity and uses its last-modified time as the
 * revision, so reading the same window again is harmless and an edited session replaces the old one.
 */
object HealthImport {
    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
    )
    const val BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    /** How far back each pass reads. Exports from the watch can arrive hours late. */
    private val WINDOW: Duration = Duration.ofDays(3)

    fun available(context: Context) = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    /** Reads the window and returns ledger records, or a reason nothing was read. */
    suspend fun read(context: Context, zone: ZoneId = ZoneId.systemDefault()): Pair<List<ActivityRecord>, String> {
        if (!available(context)) return emptyList<ActivityRecord>() to "Health Connect is not available on this device"
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        val missing = permissions - granted
        if (missing.size == permissions.size) return emptyList<ActivityRecord>() to "Health Connect permissions not granted yet"
        val end = Instant.now()
        val start = end.minus(WINDOW)
        val out = mutableListOf<ActivityRecord>()
        if (HealthPermission.getReadPermission(StepsRecord::class) in granted) out += steps(readAll(client, StepsRecord::class, start, end), zone)
        if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) in granted)
            out += readAll(client, ExerciseSessionRecord::class, start, end).map { session(it, zone) }
        if (HealthPermission.getReadPermission(HydrationRecord::class) in granted)
            out += readAll(client, HydrationRecord::class, start, end).map { hydration(it, zone) }
        val note = buildString {
            append("read ${out.size} records from Health Connect")
            if (missing.isNotEmpty()) append(" (${missing.size} of ${permissions.size} kinds not permitted)")
        }
        return out to note
    }

    private suspend fun <T : Record> readAll(client: HealthConnectClient, type: KClass<T>, start: Instant, end: Instant): List<T> {
        val all = mutableListOf<T>()
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(type, TimeRangeFilter.between(start, end), pageToken = token))
            all += page.records
            token = page.pageToken
        } while (token != null)
        return all
    }

    /** One daily total per source app and local day: the ledger takes the best single source. */
    private fun steps(records: List<StepsRecord>, zone: ZoneId): List<ActivityRecord> =
        records.groupBy { it.metadata.dataOrigin.packageName to it.startTime.atZone(zone).toLocalDate() }
            .map { (key, group) ->
                val (origin, date) = key
                ActivityRecord(
                    source = "hc:$origin",
                    sourceRecordId = "steps-$date",
                    revision = group.maxOf { it.metadata.lastModifiedTime.toEpochMilli() },
                    kind = "steps",
                    start = date.toString(),
                    timeZone = zone.id,
                    quantities = mapOf("steps" to group.sumOf { it.count }),
                )
            }

    private fun session(r: ExerciseSessionRecord, zone: ZoneId) = ActivityRecord(
        source = "hc:${r.metadata.dataOrigin.packageName}",
        sourceRecordId = r.metadata.id,
        revision = r.metadata.lastModifiedTime.toEpochMilli(),
        kind = kindOf(r.exerciseType),
        start = r.startTime.toString(),
        end = r.endTime.toString(),
        timeZone = zone.id,
        quantities = mapOf("durationMin" to Duration.between(r.startTime, r.endTime).toMinutes()),
        note = r.title,
    )

    private fun hydration(r: HydrationRecord, zone: ZoneId) = ActivityRecord(
        source = "hc:${r.metadata.dataOrigin.packageName}",
        sourceRecordId = r.metadata.id,
        revision = r.metadata.lastModifiedTime.toEpochMilli(),
        kind = "hydration",
        start = r.startTime.toString(),
        end = r.endTime.toString(),
        timeZone = zone.id,
        quantities = mapOf("amountMl" to r.volume.inMilliliters.toInt()),
    )

    /** Health Connect exercise types onto the ledger's kinds (service/src/rules.ts). */
    fun kindOf(type: Int): String = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walk"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "run"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hike"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "cycle"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "swim"
        ExerciseSessionRecord.EXERCISE_TYPE_WHEELCHAIR -> "wheelchair"
        ExerciseSessionRecord.EXERCISE_TYPE_DANCING -> "dance"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "elliptical"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "rowing"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "strength"
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "bodyweight"
        ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING -> "stretch"
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "yoga"
        ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "pilates"
        ExerciseSessionRecord.EXERCISE_TYPE_GUIDED_BREATHING -> "meditation"
        else -> "movement"
    }
}
