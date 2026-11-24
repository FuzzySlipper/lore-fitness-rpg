package io.github.fuzzyslipper.lorefitness.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.CircularProgressIndicator
import androidx.wear.protolayout.material.ProgressIndicatorColors
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.protolayout.material.layouts.EdgeContentLayout
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/** The Skyhold tile: today's readiness as an arc, the level, and a tap into the app. */
class SkyholdTile : TileService() {
    override fun onTileRequest(request: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val readiness = Readiness.of(WatchStore.get(this).state.value)
        val gold = argb(0xFFD4A64A.toInt())
        val open = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder().setAndroidActivity(
                    ActionBuilders.AndroidActivity.Builder().setPackageName(packageName)
                        .setClassName("io.github.fuzzyslipper.lorefitness.wear.MainActivity").build(),
                ).build(),
            ).build()
        val title = if (readiness.known) "${readiness.earned} of 6 ready" else "Open Skyhold"
        val detail = when {
            !readiness.known -> "Waiting for the phone"
            readiness.pending > 0 -> "Level ${readiness.level} · ${readiness.pending} waiting"
            else -> "Level ${readiness.level}"
        }
        val content = LayoutElementBuilders.Column.Builder()
            .addContent(Text.Builder(this, title).setTypography(Typography.TYPOGRAPHY_TITLE2).setColor(gold).build())
            .addContent(Text.Builder(this, detail).setTypography(Typography.TYPOGRAPHY_CAPTION1).setColor(argb(0xFFFFFFFF.toInt())).build())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(open).build())
            .build()
        val layout = EdgeContentLayout.Builder(request.deviceConfiguration)
            .setEdgeContent(
                CircularProgressIndicator.Builder()
                    .setProgress(readiness.earned / 6f)
                    .setCircularProgressIndicatorColors(ProgressIndicatorColors(gold, argb(0xFF3A3A3A.toInt())))
                    .build(),
            )
            .setPrimaryLabelTextContent(Text.Builder(this, "Skyhold").setTypography(Typography.TYPOGRAPHY_CAPTION2).setColor(gold).build())
            .setContent(content)
            .build()
        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion("1")
            .setFreshnessIntervalMillis(30 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(request: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())
}
