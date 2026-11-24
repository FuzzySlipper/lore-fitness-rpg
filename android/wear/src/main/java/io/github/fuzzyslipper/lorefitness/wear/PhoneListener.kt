package io.github.fuzzyslipper.lorefitness.wear

import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import io.github.fuzzyslipper.lorefitness.core.DataLayer

class PhoneListener : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.dataItem.uri.path != DataLayer.STATE) continue
            val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString(DataLayer.KEY_STATE) ?: continue
            WatchStore.get(this).saveState(json)
        }
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == DataLayer.CHECK_IN_ACK) WatchStore.get(this).acknowledge(String(event.data))
    }
}
