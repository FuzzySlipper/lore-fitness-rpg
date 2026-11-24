package io.github.fuzzyslipper.lorefitness.wear

import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester

/** Today's readiness: how many of the six daily categories are earned, from the phone's last state. */
data class Readiness(val earned: Int, val level: Int?, val pending: Int, val known: Boolean) {
    companion object {
        fun of(state: WatchState): Readiness {
            val phone = state.phoneState
            val categories = phone?.optJSONArray("categories")
            val earned = categories?.let { a -> (0 until a.length()).count { a.getJSONObject(it).optBoolean("earned") } } ?: 0
            return Readiness(earned, phone?.optJSONObject("character")?.optInt("level"), state.pending, phone != null)
        }
    }
}

/** Ask the tile and the complication to redraw after new state or a check-in. */
fun refreshSurfaces(context: Context) {
    runCatching { TileService.getUpdater(context).requestUpdate(SkyholdTile::class.java) }
    runCatching {
        ComplicationDataSourceUpdateRequester.create(context, ComponentName(context, ReadinessComplication::class.java)).requestUpdateAll()
    }
}
