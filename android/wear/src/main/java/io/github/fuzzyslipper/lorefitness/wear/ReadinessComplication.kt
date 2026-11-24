package io.github.fuzzyslipper.lorefitness.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

/** Skyhold readiness for watch faces: earned categories out of six, from the phone's last state. */
class ReadinessComplication : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? =
        data(request.complicationType, Readiness.of(WatchStore.get(this).state.value))

    override fun getPreviewData(type: ComplicationType): ComplicationData? = data(type, Readiness(4, 6, 0, true))

    private fun data(type: ComplicationType, readiness: Readiness): ComplicationData? {
        val text = PlainComplicationText.Builder(if (readiness.known) "${readiness.earned}/6" else "–").build()
        val description = PlainComplicationText.Builder("Skyhold readiness: ${readiness.earned} of 6 daily categories earned").build()
        val tap = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return when (type) {
            ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(readiness.earned.toFloat(), 0f, 6f, description)
                .setText(text).setTapAction(tap).build()
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(text, description)
                .setTitle(PlainComplicationText.Builder("Ready").build()).setTapAction(tap).build()
            else -> null
        }
    }
}
