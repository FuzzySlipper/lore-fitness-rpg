package io.github.fuzzyslipper.lorefitness

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import io.github.fuzzyslipper.lorefitness.core.ActivityRecord
import io.github.fuzzyslipper.lorefitness.core.DataLayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * The watch's way to the ledger. A watch check-in is queued here first (so it survives the phone
 * being offline), and the watch is told it arrived only once the ledger accepted it; until then the
 * watch keeps its own copy and sends it again.
 */
class WatchListener : WearableListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(event: MessageEvent) {
        when (event.path) {
            DataLayer.CHECK_IN -> {
                val record = runCatching { ActivityRecord.fromStorage(JSONObject(String(event.data))) }.getOrNull() ?: return
                Store.get(this).enqueue(record)
                Sync.requestSoon(this)
                scope.launch { syncAndAck(event.sourceNodeId) }
            }
            DataLayer.SYNC_REQUEST -> scope.launch { syncAndAck(event.sourceNodeId) }
        }
    }

    private suspend fun syncAndAck(node: String) {
        val accepted = Sync.run(this, importHealth = false)
        val client = Wearable.getMessageClient(this)
        for (record in accepted.filter { it.source == "lfr-watch" }) {
            runCatching { client.sendMessage(node, DataLayer.CHECK_IN_ACK, record.key.toByteArray()).await() }
        }
    }
}
