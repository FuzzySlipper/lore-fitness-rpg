package io.github.fuzzyslipper.lorefitness.wear

import android.content.Context
import androidx.health.services.client.ExerciseUpdateCallback
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.ExerciseConfig
import androidx.health.services.client.data.ExerciseLapSummary
import androidx.health.services.client.data.ExerciseTrackedStatus
import androidx.health.services.client.data.ExerciseType
import androidx.health.services.client.data.ExerciseUpdate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.guava.await
import java.time.Duration

/**
 * Records a guided drill as a Health Services exercise, so the watch measures it like any workout:
 * active time, heart rate and calories where the watch offers them. When it cannot (another app,
 * such as OHealth, is recording; permission was refused; the type is unsupported) the drill still
 * runs as a timer and says why: a drill never waits on a sensor.
 */
class DrillRecorder(context: Context) {
    private val client = HealthServices.getClient(context.applicationContext).exerciseClient

    data class Reading(
        val recording: Boolean = false,
        val note: String? = null,
        val heartRate: Int? = null,
        val activeSeconds: Long? = null,
        val calories: Double? = null,
        val heartRateSum: Double = 0.0,
        val heartRateCount: Int = 0,
    ) {
        val averageHeartRate: Int? get() = if (heartRateCount > 0) (heartRateSum / heartRateCount).toInt() else null
    }

    private val _reading = MutableStateFlow(Reading())
    val reading: StateFlow<Reading> = _reading

    private val callback = object : ExerciseUpdateCallback {
        override fun onExerciseUpdateReceived(update: ExerciseUpdate) {
            val metrics = update.latestMetrics
            val beats = metrics.getData(DataType.HEART_RATE_BPM)
            val calories = metrics.getData(DataType.CALORIES_TOTAL)?.total
            val active = update.activeDurationCheckpoint?.let { cp ->
                cp.activeDuration.plus(Duration.between(cp.time, java.time.Instant.now()).takeIf { update.exerciseStateInfo.state.isPaused.not() } ?: Duration.ZERO)
            }
            val current = _reading.value
            _reading.value = current.copy(
                heartRate = beats.lastOrNull()?.value?.toInt() ?: current.heartRate,
                calories = calories ?: current.calories,
                activeSeconds = active?.seconds ?: current.activeSeconds,
                heartRateSum = current.heartRateSum + beats.sumOf { it.value },
                heartRateCount = current.heartRateCount + beats.size,
            )
        }
        override fun onLapSummaryReceived(lapSummary: ExerciseLapSummary) {}
        override fun onRegistered() {}
        override fun onRegistrationFailed(throwable: Throwable) {
            _reading.value = _reading.value.copy(note = "Recording unavailable: ${throwable.message}")
        }
        override fun onAvailabilityChanged(dataType: DataType<*, *>, availability: Availability) {}
    }

    /** Starts recording if it can; the reason it did not is in [reading]'s note. */
    suspend fun start(drill: Drill, permitted: Boolean): Boolean {
        if (!permitted) return fallback("Sensors not permitted; timing only")
        return try {
            val info = client.getCurrentExerciseInfoAsync().await()
            if (info.exerciseTrackedStatus == ExerciseTrackedStatus.OTHER_APP_IN_PROGRESS)
                return fallback("Another app is recording a workout; timing only")
            val capabilities = client.getCapabilitiesAsync().await()
            val type = typesFor(drill).firstOrNull { it in capabilities.supportedExerciseTypes }
                ?: return fallback("This watch does not record ${drill.category.label.lowercase()} sessions; timing only")
            val offered = capabilities.getExerciseTypeCapabilities(type).supportedDataTypes
            val wanted = setOf(DataType.HEART_RATE_BPM, DataType.CALORIES_TOTAL).filter { it in offered }.toSet()
            client.setUpdateCallback(callback)
            client.startExerciseAsync(
                ExerciseConfig.builder(type).setDataTypes(wanted).setIsAutoPauseAndResumeEnabled(false).setIsGpsEnabled(false).build(),
            ).await()
            _reading.value = Reading(recording = true, note = "Recording as ${type.name.lowercase().replace('_', ' ')}")
            true
        } catch (e: Exception) {
            fallback("Recording unavailable (${e.message}); timing only")
        }
    }

    suspend fun pause() { if (_reading.value.recording) runCatching { client.pauseExerciseAsync().await() } }
    suspend fun resume() { if (_reading.value.recording) runCatching { client.resumeExerciseAsync().await() } }

    /** Ends the recording and returns what it measured; null values were not measured. */
    suspend fun finish(): Reading {
        if (_reading.value.recording) {
            runCatching { client.endExerciseAsync().await() }
            runCatching { client.clearUpdateCallbackAsync(callback).await() }
        }
        return _reading.value
    }

    private fun fallback(note: String): Boolean {
        _reading.value = Reading(recording = false, note = note)
        return false
    }

    /** Health Services types for a drill, best first. */
    private fun typesFor(drill: Drill): List<ExerciseType> = when (drill.id) {
        "cullen" -> listOf(ExerciseType.STRENGTH_TRAINING, ExerciseType.CALISTHENICS, ExerciseType.WORKOUT)
        "bull" -> listOf(ExerciseType.WALKING, ExerciseType.WORKOUT)
        "cassandra" -> listOf(ExerciseType.STRETCHING, ExerciseType.YOGA, ExerciseType.WORKOUT)
        else -> listOf(ExerciseType.WORKOUT)
    }
}
